import { Category, DiningTable, Order, type OrderLine, type Product, type SideDish, type Station, type Ticket, type Wish } from "../../src/domain/index.js";
import type { Clock, MenuRepository, OrderRepository, TableRepository, TicketRepository } from "../../src/logic/index.js";
import { babiPangang, beer, cola, mihoen, nasi, noGarlic, noOnion, now, whiteRice } from "./builders.js";

export class FixedClock implements Clock {
  now(): Date {
    return now;
  }
}

export class FakeTableRepository implements TableRepository {
  readonly tables = [new DiningTable(4, "4"), new DiningTable(5, "5")];

  async getTables(): Promise<DiningTable[]> {
    return this.tables;
  }

  async getTable(tableId: number): Promise<DiningTable | null> {
    return this.tables.find((table) => table.id === tableId) ?? null;
  }
}

export class FakeOrderRepository implements OrderRepository {
  readonly orders: Order[] = [];
  readonly savedLines: OrderLine[] = [];
  readonly quantityChanges: { lineId: number; step: 1 | -1 }[] = [];
  readonly savedTickets: Ticket[] = [];
  closeSucceeds = true;
  createCount = 0;

  async getOpenOrders(): Promise<Order[]> {
    return this.orders.filter((order) => !order.isClosed);
  }

  async getOpenOrder(tableId: number): Promise<Order | null> {
    return this.orders.find((order) => order.table.id === tableId && !order.isClosed) ?? null;
  }

  async createOrder(tableId: number, openedAt: Date): Promise<void> {
    this.createCount++;
    this.orders.push(new Order(this.createCount, new DiningTable(tableId, String(tableId)), openedAt));
  }

  async addLine(_orderId: number, line: OrderLine): Promise<void> {
    this.savedLines.push(line);
  }

  async increaseQuantity(_orderId: number, lineId: number): Promise<void> {
    this.quantityChanges.push({ lineId, step: 1 });
  }

  async decreaseQuantity(_orderId: number, lineId: number): Promise<void> {
    this.quantityChanges.push({ lineId, step: -1 });
  }

  async saveSend(_orderId: number, _sentLines: readonly OrderLine[], tickets: readonly Ticket[]): Promise<number[]> {
    this.savedTickets.push(...tickets);
    return tickets.map((_ticket, i) => i + 1);
  }

  async close(): Promise<boolean> {
    return this.closeSucceeds;
  }
}

export class FakeMenuRepository implements MenuRepository {
  async getCategories(): Promise<Category[]> {
    return [new Category(9, "Kip", [babiPangang]), new Category(15, "Dranken", [cola, beer])];
  }

  async getProduct(productId: number): Promise<Product | null> {
    return [babiPangang, cola, beer].find((product) => product.id === productId) ?? null;
  }

  async getSideDishes(): Promise<SideDish[]> {
    return [whiteRice, nasi, mihoen];
  }

  async getWishes(): Promise<Wish[]> {
    return [noOnion, noGarlic];
  }
}

export class FakeTicketRepository implements TicketRepository {
  readonly tickets: Ticket[] = [];

  async getOpenTickets(station: Station): Promise<Ticket[]> {
    return this.tickets.filter((ticket) => ticket.doneAt === null && ticket.station === station);
  }

  async getTicket(ticketId: number): Promise<Ticket | null> {
    return this.tickets.find((ticket) => ticket.id === ticketId) ?? null;
  }

  async markDone(): Promise<boolean> {
    return true;
  }
}
