import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { BillService, OrderService, TableService, TicketService } from "../../src/logic/index.js";
import { createApp } from "../../src/web/app.js";
import { html, SafeHtml } from "../../src/web/html.js";
import { FakeMenuRepository, FakeOrderRepository, FakeTableRepository, FakeTicketRepository, FixedClock } from "../support/fakes.js";

class DatabaseDown extends Error {}

class BrokenTableRepository extends FakeTableRepository {
  override async getTables(): Promise<never> {
    throw new DatabaseDown("connection refused");
  }
}

function start(tables: FakeTableRepository): Promise<{ server: Server; base: string; logged: string[] }> {
  const clock = new FixedClock();
  const orders = new FakeOrderRepository();
  const logged: string[] = [];
  const app = createApp(
    {
      tables: new TableService(tables, orders, clock),
      orders: new OrderService(orders, new FakeMenuRepository(), clock),
      bills: new BillService(orders),
      tickets: new TicketService(new FakeTicketRepository(), clock),
      clock,
    },
    { publicFolder: "public", isDatabaseError: (error) => error instanceof DatabaseDown, log: (message) => logged.push(message) },
  );
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, base: `http://localhost:${(server.address() as AddressInfo).port}`, logged });
    });
  });
}

describe("html", () => {
  it("escapes text so it cannot become markup", () => {
    assert.equal(html`<b>${'<script>alert("x")</script>'}</b>`.value, "<b>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</b>");
  });

  it("does not escape html that is already safe", () => {
    assert.equal(html`<p>${new SafeHtml("<i>a</i>")}</p>`.value, "<p><i>a</i></p>");
  });

  it("renders nothing for null and false", () => {
    assert.equal(html`a${null}b${false}c`.value, "abc");
  });
});

describe("Web", () => {
  let app: Awaited<ReturnType<typeof start>>;

  before(async () => {
    app = await start(new FakeTableRepository());
  });

  after(() => {
    app.server.close();
  });

  const post = (path: string, body: string, origin: string | null = app.base) =>
    fetch(app.base + path, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        referer: `${app.base}/tables`,
        ...(origin === null ? {} : { origin }),
      },
      body,
    });

  it("shows the tables", async () => {
    const page = await (await fetch(`${app.base}/tables`)).text();
    assert.match(page, /Tafel 4/);
    assert.match(page, /0 van de 2 open/);
  });

  it("opens a table and goes to its order", async () => {
    const response = await post("/tables/open", "tableId=4");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/orders/4");
  });

  it("refuses a form posted from another website", async () => {
    const response = await post("/tables/open", "tableId=5", "https://evil.example");
    assert.equal(response.status, 403);
  });

  it("refuses a form without an origin", async () => {
    const response = await post("/tables/open", "tableId=5", null);
    assert.equal(response.status, 403);
  });

  it("goes back with the message when a rule is broken", async () => {
    const response = await post("/tables/open", "tableId=99");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/tables");
    assert.match(response.headers.get("set-cookie") ?? "", /melding=Tafel%2099%20bestaat%20niet/);
  });

  it("puts a drink on the table from the tile and stays on the drinks", async () => {
    await post("/tables/open", "tableId=5");
    const response = await post("/orders/5/drinks/200/plus", "");
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/orders/5?view=drinks&category=15");
    const page = await (await fetch(`${app.base}/orders/5?view=drinks`)).text();
    assert.match(page, /id="drink-200"[\s\S]*?<b class="" aria-live="polite">1<\/b>/);
  });

  it("refuses − on a drink that is not on the table, with the message", async () => {
    await post("/tables/open", "tableId=5");
    const response = await post("/orders/5/drinks/201/minus", "");
    assert.match(response.headers.get("set-cookie") ?? "", /melding=Er%20staat%20geen%20nieuwe%20Bier/);
  });

  it("shows the bar tickets on their own screen", async () => {
    const page = await (await fetch(`${app.base}/tickets?station=bar`)).text();
    assert.match(page, /<h1>Bonnen bar<\/h1>/);
  });

  it("answers 400 to a malformed id", async () => {
    const response = await post("/tables/open", "tableId=abc");
    assert.equal(response.status, 400);
  });

  it("shows the message once on the next page", async () => {
    const page = await (await fetch(`${app.base}/tables`, { headers: { cookie: "melding=Tafel%2099%20bestaat%20niet." } })).text();
    assert.match(page, /Tafel 99 bestaat niet\./);
  });

  it("does not send the staff to another website after an error", async () => {
    const page = await (await fetch(`${app.base}/problem?returnUrl=//evil.example`)).text();
    assert.doesNotMatch(page, /evil\.example/);
  });
});

describe("Web without database", () => {
  it("shows the problem page and logs the error", async () => {
    const app = await start(new BrokenTableRepository());
    try {
      const response = await fetch(`${app.base}/tables`, { redirect: "manual" });
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("location"), "/problem?returnUrl=%2Ftables&saving=false");
      assert.equal(app.logged.length, 1);
    } finally {
      app.server.close();
    }
  });
});
