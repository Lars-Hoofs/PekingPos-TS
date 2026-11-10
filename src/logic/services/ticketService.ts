import { RuleError, type Station, type Ticket } from "../../domain/index.js";
import type { Clock } from "../interfaces/clock.js";
import type { TicketRepository } from "../interfaces/ticketRepository.js";

export class TicketService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly clock: Clock,
  ) {}

  getOpenTickets(station: Station): Promise<Ticket[]> {
    return this.tickets.getOpenTickets(station);
  }

  async getTicket(ticketId: number): Promise<Ticket> {
    const ticket = await this.tickets.getTicket(ticketId);
    if (ticket === null) {
      throw new RuleError("Deze bon bestaat niet.");
    }
    return ticket;
  }

  /** Returns the ticket, so the caller knows which station's screen to go back to. */
  async markDone(ticketId: number): Promise<Ticket> {
    const ticket = await this.getTicket(ticketId);
    const now = this.clock.now();
    ticket.markDone(now);
    if (!(await this.tickets.markDone(ticketId, now))) {
      throw new RuleError("Deze bon is al klaar gemeld.");
    }
    return ticket;
  }
}
