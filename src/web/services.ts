import type { BillService, Clock, OrderService, TableService, TicketService } from "../logic/index.js";

/** Everything the web layer needs from the logic layer. The composition root fills it in. */
export interface Services {
  tables: TableService;
  orders: OrderService;
  bills: BillService;
  tickets: TicketService;
  clock: Clock;
}
