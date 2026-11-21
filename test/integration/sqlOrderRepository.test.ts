import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import sql from "mssql";
import { readConfig } from "../../src/config.js";
import { Database, SqlMenuRepository, SqlOrderRepository, SqlTicketRepository } from "../../src/dal/index.js";
import { Order, RuleError, Station } from "../../src/domain/index.js";

// Runs against the test database from .env (DB_TEST_NAME). DB/setup.sh creates it.
const testDatabase = process.env["DB_TEST_NAME"];

describe("SqlOrderRepository", { skip: testDatabase === undefined ? "DB_TEST_NAME is not set; run DB/setup.sh" : false }, () => {
  let database: Database;
  let orders: SqlOrderRepository;
  let tableId = 0;

  const query = async (text: string, parameters: Record<string, number | string> = {}) => {
    const request = await database.request(
      Object.entries(parameters).map(([name, value]) => ({
        name,
        type: typeof value === "number" ? sql.Int : sql.NVarChar(50),
        value,
      })),
    );
    return request.query(text);
  };

  before(() => {
    database = new Database({ ...readConfig(process.env).database, database: testDatabase ?? "" });
    orders = new SqlOrderRepository(database);
  });

  after(async () => {
    await database.close();
  });

  beforeEach(async () => {
    const result = await query("INSERT INTO DiningTable (Name, SortOrder) OUTPUT INSERTED.Id VALUES (@Name, 0)", {
      Name: randomUUID().slice(0, 10),
    });
    tableId = (result.recordset[0] as { Id: number }).Id;
  });

  afterEach(async () => {
    await query(
      `DELETE FROM OrderLineWish WHERE OrderLineId IN (SELECT l.Id FROM OrderLine l JOIN TableOrder o ON o.Id = l.TableOrderId WHERE o.DiningTableId = @Id);
       DELETE FROM OrderLine WHERE TableOrderId IN (SELECT Id FROM TableOrder WHERE DiningTableId = @Id);
       DELETE FROM Ticket WHERE TableOrderId IN (SELECT Id FROM TableOrder WHERE DiningTableId = @Id);
       DELETE FROM TableOrder WHERE DiningTableId = @Id;
       DELETE FROM DiningTable WHERE Id = @Id;`,
      { Id: tableId },
    );
  });

  const firstDishWithSideDish = async () => {
    const result = await query("SELECT TOP 1 Id FROM Product WHERE OffersSideDish = 1 ORDER BY Id");
    const product = await new SqlMenuRepository(database).getProduct((result.recordset[0] as { Id: number }).Id);
    assert.ok(product !== null);
    return product;
  };

  it("keeps one open order when eight staff open the same table at the same moment", async () => {
    await Promise.all(Array.from({ length: 8 }, () => orders.createOrder(tableId, new Date())));
    const open = (await orders.getOpenOrders()).filter((order) => order.table.id === tableId);
    assert.equal(open.length, 1);
  });

  it("gives every line its own number when four connections add at the same moment", async () => {
    await orders.createOrder(tableId, new Date());
    const order = await orders.getOpenOrder(tableId);
    assert.ok(order !== null);
    const product = await firstDishWithSideDish();

    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let i = 0; i < 10; i++) {
          await orders.addLine(order.id, new Order(order.id, order.table, order.openedAt).addLine(product, 1), new Date());
        }
      }),
    );

    const numbers = (await orders.getOpenOrder(tableId))?.lines.map((line) => line.lineNumber) ?? [];
    assert.equal(numbers.length, 40);
    assert.equal(new Set(numbers).size, 40);
  });

  it("stores a line with its side dish, wishes and price, and reads it back the same", async () => {
    await orders.createOrder(tableId, new Date());
    const order = await orders.getOpenOrder(tableId);
    assert.ok(order !== null);
    const menu = new SqlMenuRepository(database);
    const product = await firstDishWithSideDish();
    const sideDish = (await menu.getSideDishes()).find((s) => !s.surcharge.isZero());
    const wish = (await menu.getWishes())[0];
    assert.ok(sideDish !== undefined && wish !== undefined);

    const line = order.addLine(product, 2);
    line.chooseSideDish(sideDish);
    line.toggleWish(wish);
    await orders.addLine(order.id, line, new Date());

    const stored = (await orders.getOpenOrder(tableId))?.lines[0];
    assert.equal(stored?.price().cents, line.price().cents);
    assert.equal(stored?.sideDish?.id, sideDish.id);
    assert.deepEqual(stored?.wishes.map((w) => w.id), [wish.id]);
  });

  const firstDrink = async () => {
    const result = await query("SELECT TOP 1 Id FROM Product WHERE Kind = 2 ORDER BY Id");
    const product = await new SqlMenuRepository(database).getProduct((result.recordset[0] as { Id: number }).Id);
    assert.ok(product !== null);
    return product;
  };

  const openOrderWithId = async () => {
    await orders.createOrder(tableId, new Date());
    const order = await orders.getOpenOrder(tableId);
    assert.ok(order !== null);
    return order;
  };

  it("makes a kitchen ticket and a bar ticket, and refuses to send the same lines twice", async () => {
    const order = await openOrderWithId();
    await orders.addLine(order.id, order.addLine(await firstDishWithSideDish(), 1), new Date());
    await orders.addLine(order.id, order.addLine(await firstDrink(), 2), new Date());

    const loaded = await orders.getOpenOrder(tableId);
    assert.ok(loaded !== null);
    const newLines = loaded.newLines;
    const ticketIds = await orders.saveSend(loaded.id, newLines, loaded.send(new Date()));
    assert.equal(ticketIds.length, 2);

    const tickets = new SqlTicketRepository(database);
    const [kitchen, bar] = await Promise.all(ticketIds.map((id) => tickets.getTicket(id)));
    assert.equal(kitchen?.station, Station.Kitchen);
    assert.equal(kitchen?.lines.length, 1);
    assert.equal(bar?.station, Station.Bar);
    assert.equal(bar?.lines[0]?.quantity, 2);
    assert.ok((await tickets.getOpenTickets(Station.Bar)).some((ticket) => ticket.id === bar?.id));
    assert.ok(!(await tickets.getOpenTickets(Station.Kitchen)).some((ticket) => ticket.id === bar?.id));

    await assert.rejects(orders.saveSend(loaded.id, newLines, []), RuleError);
  });

  it("counts every tap when three staff tap + on the same drink at the same moment", async () => {
    const order = await openOrderWithId();
    await orders.addLine(order.id, order.addLine(await firstDrink(), 1), new Date());
    const lineId = (await orders.getOpenOrder(tableId))?.lines[0]?.id;
    assert.ok(lineId !== null && lineId !== undefined);

    await Promise.all(Array.from({ length: 3 }, () => orders.increaseQuantity(order.id, lineId)));

    assert.equal((await orders.getOpenOrder(tableId))?.lines[0]?.quantity, 4);
  });

  it("lowers a drink and deletes the line at the last one", async () => {
    const order = await openOrderWithId();
    await orders.addLine(order.id, order.addLine(await firstDrink(), 2), new Date());
    const lineId = (await orders.getOpenOrder(tableId))?.lines[0]?.id;
    assert.ok(lineId !== null && lineId !== undefined);

    await orders.decreaseQuantity(order.id, lineId);
    assert.equal((await orders.getOpenOrder(tableId))?.lines[0]?.quantity, 1);
    await orders.decreaseQuantity(order.id, lineId);
    assert.equal((await orders.getOpenOrder(tableId))?.lines.length, 0);
    await assert.rejects(orders.decreaseQuantity(order.id, lineId), RuleError);
  });

  it("refuses + and − on a line that was sent", async () => {
    const order = await openOrderWithId();
    await orders.addLine(order.id, order.addLine(await firstDrink(), 2), new Date());
    const loaded = await orders.getOpenOrder(tableId);
    assert.ok(loaded !== null);
    const newLines = loaded.newLines;
    await orders.saveSend(loaded.id, newLines, loaded.send(new Date()));
    const lineId = newLines[0]?.id;
    assert.ok(lineId !== null && lineId !== undefined);

    await assert.rejects(orders.increaseQuantity(order.id, lineId), RuleError);
    await assert.rejects(orders.decreaseQuantity(order.id, lineId), RuleError);
  });

  it("closes an order once", async () => {
    await orders.createOrder(tableId, new Date());
    const order = await orders.getOpenOrder(tableId);
    assert.ok(order !== null);
    assert.equal(await orders.close(order.id, new Date()), true);
    assert.equal(await orders.close(order.id, new Date()), false);
  });
});
