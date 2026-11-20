import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Course, Dish, LineStatus, OrderLine, RuleError, Station, VatRate } from "../../src/domain/index.js";
import { babiPangang, beer, cola, euros, loempia, nasi, now, openOrder } from "../support/builders.js";

describe("Order", () => {
  it("adds a line to an open order", () => {
    const order = openOrder();
    order.addLine(cola, 1);
    assert.equal(order.lines[0]?.product, cola);
  });

  it("gives the second line the next line number", () => {
    const order = openOrder();
    assert.equal(order.addLine(cola, 1).lineNumber, 1);
    assert.equal(order.addLine(cola, 1).lineNumber, 2);
  });

  it("accepts 99", () => {
    assert.equal(openOrder().addLine(cola, 99).quantity, 99);
  });

  for (const quantity of [0, 100, -1, 1.5, Number.NaN]) {
    it(`refuses quantity ${quantity} and adds nothing`, () => {
      const order = openOrder();
      assert.throws(() => order.addLine(cola, quantity), RuleError);
      assert.equal(order.lines.length, 0);
    });
  }

  it("refuses a line on a closed order", () => {
    const order = openOrder();
    order.close(now);
    assert.throws(() => order.addLine(cola, 1), RuleError);
  });

  it("does not let a caller change the lines from outside", () => {
    const order = openOrder();
    order.addLine(cola, 1);
    (order.lines as unknown as unknown[]).length = 0;
    assert.equal(order.lines.length, 1);
  });

  it("sends the food to the kitchen and the drinks to the bar, and marks every new line as sent", () => {
    const order = openOrder();
    const dish = order.addLine(babiPangang, 1);
    const drink = order.addLine(beer, 2);
    const tickets = order.send(now);
    assert.deepEqual(tickets.map((ticket) => ticket.station), [Station.Kitchen, Station.Bar]);
    assert.deepEqual(tickets[0]?.lines, [dish]);
    assert.deepEqual(tickets[1]?.lines, [drink]);
    assert.equal(order.newLines.length, 0);
  });

  it("makes only a bar ticket for drinks only", () => {
    const order = openOrder();
    const drink = order.addLine(cola, 2);
    const tickets = order.send(now);
    assert.deepEqual(tickets.map((ticket) => ticket.station), [Station.Bar]);
    assert.equal(drink.status, LineStatus.Sent);
  });

  it("makes only a kitchen ticket for food only", () => {
    const order = openOrder();
    order.addLine(babiPangang, 1);
    assert.deepEqual(order.send(now).map((ticket) => ticket.station), [Station.Kitchen]);
  });

  it("sends only the new lines the second time", () => {
    const order = openOrder();
    order.addLine(babiPangang, 1);
    order.send(now);
    const starter = order.addLine(loempia, 1);
    assert.deepEqual(order.send(now)[0]?.lines, [starter]);
  });

  it("makes no ticket when nothing is new", () => {
    const order = openOrder();
    order.addLine(babiPangang, 1);
    order.send(now);
    assert.deepEqual(order.send(now), []);
  });

  it("adds one more to the new line of the same drink", () => {
    const order = openOrder();
    const first = order.addOne(cola);
    const second = order.addOne(cola);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(order.lines.length, 1);
    assert.equal(order.newQuantityOf(cola.id), 2);
  });

  it("starts a new line when the same drink was already sent", () => {
    const order = openOrder();
    order.addOne(cola);
    order.send(now);
    assert.equal(order.addOne(cola).created, true);
    assert.equal(order.lines.length, 2);
    assert.equal(order.newQuantityOf(cola.id), 1);
  });

  it("takes one off a new drink", () => {
    const order = openOrder();
    order.addOne(cola);
    order.addOne(cola);
    assert.equal(order.removeOne(cola).removed, false);
    assert.equal(order.newQuantityOf(cola.id), 1);
  });

  it("takes the line off when the last one is removed", () => {
    const order = openOrder();
    order.addOne(cola);
    assert.equal(order.removeOne(cola).removed, true);
    assert.equal(order.lines.length, 0);
  });

  it("refuses to take off a drink that was already sent", () => {
    const order = openOrder();
    order.addOne(cola);
    order.send(now);
    assert.throws(() => order.removeOne(cola), RuleError);
    assert.equal(order.lines.length, 1);
  });

  it("refuses a hundredth on one line", () => {
    const order = openOrder();
    order.addLine(cola, OrderLine.maxQuantity);
    assert.throws(() => order.addOne(cola), RuleError);
  });

  it("adds up the line prices on the bill", () => {
    const order = openOrder();
    order.addLine(cola, 2);
    order.addLine(babiPangang, 1).chooseSideDish(nasi);
    assert.equal(order.bill().total().cents, 2320);
  });

  it("has a total of zero without lines", () => {
    assert.equal(openOrder().bill().total().cents, 0);
  });

  it("splits the VAT per rate", () => {
    const order = openOrder();
    order.addLine(new Dish(1, null, "Eten", 1, euros(51.5), VatRate.Low, Course.Main, false), 1);
    order.addLine(beer, 2);
    const vat = order.bill().vatPerRate();
    assert.equal(vat.get(VatRate.Low)?.cents, 425);
    assert.equal(vat.get(VatRate.High)?.cents, 104);
  });

  it("counts the food and the drinks that were not sent", () => {
    const order = openOrder();
    order.addLine(babiPangang, 1);
    order.addLine(cola, 1);
    assert.equal(order.bill().unsentCount(), 2);
    order.send(now);
    assert.equal(order.bill().unsentCount(), 0);
  });

  it("closes an open order", () => {
    const order = openOrder();
    order.close(now);
    assert.equal(order.closedAt, now);
  });

  it("refuses to close a closed order", () => {
    const order = openOrder();
    order.close(now);
    assert.throws(() => order.close(now), RuleError);
  });
});
