import { RuleError, type Bill } from "../../domain/index.js";
import type { OrderRepository } from "../interfaces/orderRepository.js";

export class BillService {
  constructor(private readonly orders: OrderRepository) {}

  async getBill(tableId: number): Promise<Bill> {
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${tableId} is niet open.`);
    }
    return order.bill();
  }
}
