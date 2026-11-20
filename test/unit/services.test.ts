import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { LineStatus, Money, Order, OrderLine, RuleError, Station, type Product } from "../../src/domain/index.js";
import { OrderService, TableService, TicketService } from "../../src/logic/index.js";
import { babiPangang, beer, cola, nasi, now, openOrder, table4, whiteRice } from "../support/builders.js";
import { FakeMenuRepository, FakeOrderRepository, FakeTableRepository, FakeTicketRepository, FixedClock } from "../support/fakes.js";

describe("TableService", () => {
  let orders: FakeOrderRepository;
  let service: TableService;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    service = new TableService(new FakeTableRepository(), orders, new FixedClock());
  });

  it("shows only the table with an order as open", async () => {
    orders.orders.push(openOrder());
    const overview = await service.getOverview();
    assert.equal(overview.find((status) => status.table.id === 4)?.isOpen, true);
    assert.equal(overview.find((status) => status.table.id === 5)?.isOpen, false);
  });

  it("opens a free table at the time of the clock", async () => {
    const order = await service.openTable(4);
    assert.equal(order.table.id, 4);
    assert.equal(order.openedAt, now);
  });

  it("shows the existing order when the table is already open", async () => {
    const existing = openOrder();
    orders.orders.push(existing);
    assert.equal(await service.openTable(4), existing);
    assert.equal(orders.createCount, 0);
  });

  it("refuses a table that does not exist", async () => {
    await assert.rejects(service.openTable(99), RuleError);
  });

  it("refuses to close a free table", async () => {
    await assert.rejects(service.closeTable(4), RuleError);
  });

  it("reports when a colleague closed the table first", async () => {
    orders.orders.push(openOrder());
    orders.closeSucceeds = false;
    await assert.rejects(service.closeTable(4), RuleError);
  });
});

describe("OrderService", () => {
  let orders: FakeOrderRepository;
  let service: OrderService;

  beforeEach(() => {
    orders = new FakeOrderRepository();
    service = new OrderService(orders, new FakeMenuRepository(), new FixedClock());
  });

  const request = (overrides: Partial<Parameters<OrderService["addProduct"]>[0]> = {}) => ({
    tableId: 4,
    productId: babiPangang.id,
    quantity: 1,
    sideDishId: null,
    wishIds: [],
    ...overrides,
  });

  it("refuses a product that is not on the menu", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.addProduct(request({ productId: 12345 })), RuleError);
  });

  it("refuses a product for a table that is not open, and stores nothing", async () => {
    await assert.rejects(service.addProduct(request({ productId: cola.id })), RuleError);
    assert.equal(orders.savedLines.length, 0);
  });

  it("takes the price from the menu", async () => {
    orders.orders.push(openOrder());
    await service.addProduct(request());
    assert.equal(orders.savedLines[0]?.unitPrice.cents, 1670);
  });

  it("chooses white rice when no side dish is chosen", async () => {
    orders.orders.push(openOrder());
    const line = await service.addProduct(request());
    assert.equal(line.sideDish, whiteRice);
    assert.equal(line.price().cents, 1670);
  });

  it("stores the chosen side dish with its surcharge", async () => {
    orders.orders.push(openOrder());
    const line = await service.addProduct(request({ sideDishId: nasi.id }));
    assert.equal(line.price().cents, 1720);
  });

  it("refuses an unknown side dish and stores nothing", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.addProduct(request({ sideDishId: 12345 })), RuleError);
    assert.equal(orders.savedLines.length, 0);
  });

  it("refuses a side dish on a drink", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.addProduct(request({ productId: cola.id, sideDishId: nasi.id })), RuleError);
  });

  it("refuses an unknown wish", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.addProduct(request({ wishIds: [999] })), RuleError);
  });

  it("returns no tickets when nothing is new", async () => {
    orders.orders.push(openOrder());
    assert.deepEqual(await service.send(4), []);
  });

  it("stores a kitchen ticket and a bar ticket when food and drinks are sent together", async () => {
    const order = openOrder();
    order.addLine(babiPangang, 1);
    order.addLine(beer, 1);
    orders.orders.push(order);
    assert.deepEqual(await service.send(4), [1, 2]);
    assert.deepEqual(orders.savedTickets.map((ticket) => ticket.station), [Station.Kitchen, Station.Bar]);
  });

  it("stores a new line for the first drink from the tile", async () => {
    orders.orders.push(openOrder());
    await service.addDrink(4, cola.id);
    assert.equal(orders.savedLines[0]?.product, cola);
    assert.equal(orders.quantityChanges.length, 0);
  });

  it("raises the quantity of the stored line for the next tap", async () => {
    orders.orders.push(new Order(1, table4, now, null, [storedLine(7, cola, 1)]));
    await service.addDrink(4, cola.id);
    assert.deepEqual(orders.quantityChanges, [{ lineId: 7, step: 1 }]);
    assert.equal(orders.savedLines.length, 0);
  });

  it("lowers the quantity of the stored line for −", async () => {
    orders.orders.push(new Order(1, table4, now, null, [storedLine(7, cola, 2)]));
    await service.removeDrink(4, cola.id);
    assert.deepEqual(orders.quantityChanges, [{ lineId: 7, step: -1 }]);
  });

  it("refuses + on a dish, which needs the dish window", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.addDrink(4, babiPangang.id), RuleError);
  });

  it("refuses − on a drink that is not on the table", async () => {
    orders.orders.push(openOrder());
    await assert.rejects(service.removeDrink(4, cola.id), RuleError);
  });
});

describe("TicketService", () => {
  it("refuses a ticket that does not exist", async () => {
    const service = new TicketService(new FakeTicketRepository(), new FixedClock());
    await assert.rejects(service.markDone(1), RuleError);
  });
});

function storedLine(id: number, product: Product, quantity: number): OrderLine {
  return OrderLine.restore({
    id,
    product,
    lineNumber: 1,
    quantity,
    unitPrice: product.price,
    vatRate: product.vatRate,
    sideDish: null,
    sideDishSurcharge: Money.zero,
    status: LineStatus.New,
    wishes: [],
  });
}
