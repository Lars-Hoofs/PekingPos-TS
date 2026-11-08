import type { Order, OrderLine, Ticket } from "../../domain/index.js";

export interface OrderRepository {
  getOpenOrders(): Promise<Order[]>;
  getOpenOrder(tableId: number): Promise<Order | null>;
  /** Does nothing when the table already has an open order, also when a colleague made it a moment ago. */
  createOrder(tableId: number, openedAt: Date): Promise<void>;
  addLine(orderId: number, line: OrderLine, addedAt: Date): Promise<void>;
  /** One more on a line that is not sent. Refuses when a colleague sent the line a moment ago. */
  increaseQuantity(orderId: number, lineId: number): Promise<void>;
  /** One less on a line that is not sent; a line of one is deleted. Refuses when the line was sent. */
  decreaseQuantity(orderId: number, lineId: number): Promise<void>;
  /** Stores the sent lines and the tickets together. Returns the ids of the tickets in the same order. */
  saveSend(orderId: number, sentLines: readonly OrderLine[], tickets: readonly Ticket[]): Promise<number[]>;
  /** False when the order was already closed. */
  close(orderId: number, closedAt: Date): Promise<boolean>;
}
