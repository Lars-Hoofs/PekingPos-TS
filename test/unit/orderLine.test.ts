import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BarTicket, Course, KitchenTicket, OrderLine, RuleError } from "../../src/domain/index.js";
import { babiPangang, bami, cola, loempia, mihoen, nasi, noGarlic, noOnion, now, spicy, table4 } from "../support/builders.js";

describe("OrderLine", () => {
  it("adds 50 cents for nasi", () => {
    const line = OrderLine.create(babiPangang, 1, 1);
    line.chooseSideDish(nasi);
    assert.equal(line.price().cents, 1720);
  });

  it("adds 5 euro for mihoen", () => {
    const line = OrderLine.create(babiPangang, 1, 1);
    line.chooseSideDish(mihoen);
    assert.equal(line.price().cents, 2170);
  });

  it("replaces the side dish when another is chosen", () => {
    const line = OrderLine.create(babiPangang, 1, 1);
    line.chooseSideDish(mihoen);
    line.chooseSideDish(bami);
    assert.equal(line.sideDish, bami);
    assert.equal(line.price().cents, 1720);
  });

  it("multiplies the price with the side dish by the quantity", () => {
    const line = OrderLine.create(babiPangang, 3, 1);
    line.chooseSideDish(nasi);
    assert.equal(line.price().cents, 3 * 1720);
  });

  it("refuses a side dish on a drink", () => {
    assert.throws(() => OrderLine.create(cola, 1, 1).chooseSideDish(nasi), RuleError);
  });

  it("refuses a wish on a drink", () => {
    assert.throws(() => OrderLine.create(cola, 1, 1).toggleWish(noOnion), RuleError);
  });

  it("keeps two wishes in the order they were chosen", () => {
    const line = OrderLine.create(babiPangang, 1, 1);
    line.toggleWish(noOnion);
    line.toggleWish(noGarlic);
    assert.deepEqual(line.wishes, [noOnion, noGarlic]);
  });

  it("takes a wish off when it is chosen twice", () => {
    const line = OrderLine.create(babiPangang, 1, 1);
    line.toggleWish(noOnion);
    line.toggleWish(noOnion);
    assert.equal(line.wishes.length, 0);
  });

  it("refuses to change the quantity of a sent line", () => {
    const line = OrderLine.create(cola, 2, 1);
    line.markSent();
    assert.throws(() => line.increase(), RuleError);
    assert.throws(() => line.decrease(), RuleError);
  });

  it("writes a wish to remove with a minus and a wish to add with a plus", () => {
    assert.equal(noOnion.toTicketText(), "− ui");
    assert.equal(spicy.toTicketText(), "+ pikant");
  });
});

describe("Ticket", () => {
  it("puts the starters before the mains", () => {
    const main = OrderLine.create(babiPangang, 1, 1);
    const starter = OrderLine.create(loempia, 1, 2);
    const ticket = new KitchenTicket(1, table4, now, null, [main, starter]);
    assert.deepEqual(
      ticket.groups().map((group) => group.course),
      [Course.Starter, Course.Main],
    );
  });

  it("refuses a drink on a kitchen ticket", () => {
    assert.throws(() => new KitchenTicket(1, table4, now, null, [OrderLine.create(cola, 1, 1)]));
  });

  it("refuses food on a bar ticket", () => {
    assert.throws(() => new BarTicket(1, table4, now, null, [OrderLine.create(loempia, 1, 1)]));
  });

  it("puts all drinks in one group without a course", () => {
    const ticket = new BarTicket(1, table4, now, null, [OrderLine.create(cola, 2, 1)]);
    assert.deepEqual(ticket.groups().map((group) => group.course), [null]);
  });

  it("is marked done once", () => {
    const ticket = new KitchenTicket(1, table4, now, null, []);
    ticket.markDone(now);
    assert.equal(ticket.doneAt, now);
    assert.throws(() => ticket.markDone(now), RuleError);
  });
});
