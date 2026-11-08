import type { Station, Ticket } from "../../domain/index.js";

export interface TicketRepository {
  getOpenTickets(station: Station): Promise<Ticket[]>;
  getTicket(ticketId: number): Promise<Ticket | null>;
  /** False when the ticket was already done. */
  markDone(ticketId: number, doneAt: Date): Promise<boolean>;
}
