import sql from "mssql";
import { DiningTable, Ticket, type Station } from "../domain/index.js";
import type { TicketRepository } from "../logic/index.js";
import type { Database, Parameter } from "./database.js";
import { groupBy } from "./groupBy.js";
import { loadOrderLines } from "./orderLineReader.js";
import { date, int, nullableDate, rows, station, text } from "./row.js";

export class SqlTicketRepository implements TicketRepository {
  constructor(private readonly database: Database) {}

  getOpenTickets(station: Station): Promise<Ticket[]> {
    return this.#loadTickets("t.DoneAt IS NULL AND t.Station = @Station", [
      { name: "Station", type: sql.TinyInt, value: station },
    ]);
  }

  async getTicket(ticketId: number): Promise<Ticket | null> {
    const tickets = await this.#loadTickets("t.Id = @TicketId", [{ name: "TicketId", type: sql.Int, value: ticketId }]);
    return tickets[0] ?? null;
  }

  async markDone(ticketId: number, doneAt: Date): Promise<boolean> {
    const request = await this.database.request([
      { name: "DoneAt", type: sql.DateTime2, value: doneAt },
      { name: "Id", type: sql.Int, value: ticketId },
    ]);
    const result = await request.query("UPDATE Ticket SET DoneAt = @DoneAt WHERE Id = @Id AND DoneAt IS NULL");
    return result.rowsAffected[0] === 1;
  }

  async #loadTickets(filter: string, parameters: readonly Parameter[]): Promise<Ticket[]> {
    const loaded = (await loadOrderLines(this.database, filter, parameters)).filter((l) => l.ticketId !== null);
    const lines = groupBy(loaded, (l) => l.ticketId);
    const request = await this.database.request(parameters);
    const result = await request.query(`
      SELECT t.Id, t.Station, t.CreatedAt, t.DoneAt, d.Id AS TableId, d.Name AS TableName
      FROM Ticket t
      JOIN TableOrder o ON o.Id = t.TableOrderId
      JOIN DiningTable d ON d.Id = o.DiningTableId
      WHERE ${filter}
      ORDER BY t.CreatedAt, t.Id`);
    return rows(result.recordset).map((row) => {
      const id = int(row, "Id");
      return Ticket.forStation(
        station(row, "Station"),
        id,
        new DiningTable(int(row, "TableId"), text(row, "TableName")),
        date(row, "CreatedAt"),
        nullableDate(row, "DoneAt"),
        (lines.get(id) ?? []).map((l) => l.line),
      );
    });
  }
}
