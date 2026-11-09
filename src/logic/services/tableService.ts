import { RuleError, type DiningTable, type Order } from "../../domain/index.js";
import type { Clock } from "../interfaces/clock.js";
import type { OrderRepository } from "../interfaces/orderRepository.js";
import type { TableRepository } from "../interfaces/tableRepository.js";
import { TableStatus } from "./tableStatus.js";

export class TableService {
  constructor(
    private readonly tables: TableRepository,
    private readonly orders: OrderRepository,
    private readonly clock: Clock,
  ) {}

  async getOverview(): Promise<TableStatus[]> {
    const [tables, openOrders] = await Promise.all([this.tables.getTables(), this.orders.getOpenOrders()]);
    const orderPerTable = new Map(openOrders.map((order) => [order.table.id, order]));
    return tables.map((table) => new TableStatus(table, orderPerTable.get(table.id) ?? null));
  }

  async getTable(tableId: number): Promise<DiningTable> {
    const table = await this.tables.getTable(tableId);
    if (table === null) {
      throw new RuleError(`Tafel ${tableId} bestaat niet.`);
    }
    return table;
  }

  /** Opening a table that is already open shows its order and does not start a second one. */
  async openTable(tableId: number): Promise<Order> {
    const table = await this.getTable(tableId);
    const existing = await this.orders.getOpenOrder(tableId);
    if (existing !== null) {
      return existing;
    }
    await this.orders.createOrder(tableId, this.clock.now());
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${table.name} is net weer gesloten door een collega.`);
    }
    return order;
  }

  async getOpenOrder(tableId: number): Promise<Order> {
    const table = await this.getTable(tableId);
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${table.name} is niet open.`);
    }
    return order;
  }

  async closeTable(tableId: number): Promise<void> {
    const table = await this.getTable(tableId);
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${table.name} is al vrij.`);
    }
    const now = this.clock.now();
    order.close(now);
    if (!(await this.orders.close(order.id, now))) {
      throw new RuleError(`Tafel ${table.name} is al vrij.`);
    }
  }
}
