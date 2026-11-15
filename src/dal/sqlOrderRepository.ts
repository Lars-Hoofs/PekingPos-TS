import sql from "mssql";
import { DiningTable, LineStatus, Order, RuleError, type OrderLine, type Ticket } from "../domain/index.js";
import type { OrderRepository } from "../logic/index.js";
import { isUniqueViolation, type Database, type Parameter } from "./database.js";
import { groupBy } from "./groupBy.js";
import { loadOrderLines } from "./orderLineReader.js";
import { date, int, nullableDate, rows, text } from "./row.js";

export class SqlOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  getOpenOrders(): Promise<Order[]> {
    return this.#loadOrders("o.ClosedAt IS NULL", []);
  }

  async getOpenOrder(tableId: number): Promise<Order | null> {
    const orders = await this.#loadOrders("o.ClosedAt IS NULL AND o.DiningTableId = @TableId", [
      { name: "TableId", type: sql.Int, value: tableId },
    ]);
    return orders[0] ?? null;
  }

  async createOrder(tableId: number, openedAt: Date): Promise<void> {
    const request = await this.database.request([
      { name: "TableId", type: sql.Int, value: tableId },
      { name: "OpenedAt", type: sql.DateTime2, value: openedAt },
    ]);
    try {
      await request.query("INSERT INTO TableOrder (DiningTableId, OpenedAt) VALUES (@TableId, @OpenedAt)");
    } catch (error) {
      // The unique index allows one open order per table. When it refuses, a colleague opened
      // this table at the same moment, so the open order the caller wants exists.
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  async addLine(orderId: number, line: OrderLine, addedAt: Date): Promise<void> {
    await this.database.inTransaction(async (transaction) => {
      await this.#lockOpenOrder(transaction, orderId, "Er is niets toegevoegd.");

      const insert = await this.database.request(
        [
          { name: "OrderId", type: sql.Int, value: orderId },
          { name: "ProductId", type: sql.Int, value: line.product.id },
          { name: "Quantity", type: sql.Int, value: line.quantity },
          { name: "UnitPrice", type: sql.Decimal(6, 2), value: line.unitPrice.toEuros() },
          { name: "VatRate", type: sql.TinyInt, value: line.vatRate },
          { name: "SideDishId", type: sql.Int, value: line.sideDish?.id ?? null },
          { name: "Surcharge", type: sql.Decimal(6, 2), value: line.sideDishSurcharge.toEuros() },
          { name: "Status", type: sql.TinyInt, value: line.status },
          { name: "AddedAt", type: sql.DateTime2, value: addedAt },
        ],
        transaction,
      );
      const result = await insert.query(`
        INSERT INTO OrderLine (TableOrderId, ProductId, LineNumber, Quantity, UnitPrice, VatRate,
                               SideDishId, SideDishSurcharge, Status, AddedAt)
        OUTPUT INSERTED.Id
        SELECT @OrderId, @ProductId, ISNULL(MAX(LineNumber), 0) + 1, @Quantity, @UnitPrice, @VatRate,
               @SideDishId, @Surcharge, @Status, @AddedAt
        FROM OrderLine WHERE TableOrderId = @OrderId`);
      const lineId = int(firstRow(result.recordset), "Id");

      for (const wish of line.wishes) {
        const insertWish = await this.database.request(
          [
            { name: "LineId", type: sql.Int, value: lineId },
            { name: "WishId", type: sql.Int, value: wish.id },
          ],
          transaction,
        );
        await insertWish.query("INSERT INTO OrderLineWish (OrderLineId, StandardWishId) VALUES (@LineId, @WishId)");
      }
    });
  }

  increaseQuantity(orderId: number, lineId: number): Promise<void> {
    return this.database.inTransaction(async (transaction) => {
      await this.#lockOpenOrder(transaction, orderId, "Er is niets toegevoegd.");
      const update = await this.database.request(
        [
          { name: "LineId", type: sql.Int, value: lineId },
          { name: "OrderId", type: sql.Int, value: orderId },
          { name: "New", type: sql.TinyInt, value: LineStatus.New },
          { name: "Max", type: sql.Int, value: Order.maxQuantity },
        ],
        transaction,
      );
      // Relative to what is stored, so two taps at the same moment both count.
      const result = await update.query(`
        UPDATE OrderLine SET Quantity = Quantity + 1
        WHERE Id = @LineId AND TableOrderId = @OrderId AND Status = @New AND Quantity < @Max`);
      if (result.rowsAffected[0] !== 1) {
        throw new RuleError("Deze regel is net verstuurd of vol. Er is niets toegevoegd.");
      }
    });
  }

  decreaseQuantity(orderId: number, lineId: number): Promise<void> {
    return this.database.inTransaction(async (transaction) => {
      await this.#lockOpenOrder(transaction, orderId, "Er is niets weggehaald.");
      const parameters = [
        { name: "LineId", type: sql.Int, value: lineId },
        { name: "OrderId", type: sql.Int, value: orderId },
        { name: "New", type: sql.TinyInt, value: LineStatus.New },
      ];
      const update = await this.database.request(parameters, transaction);
      const lowered = await update.query(`
        UPDATE OrderLine SET Quantity = Quantity - 1
        WHERE Id = @LineId AND TableOrderId = @OrderId AND Status = @New AND Quantity > 1`);
      if (lowered.rowsAffected[0] === 1) {
        return;
      }
      const remove = await this.database.request(parameters, transaction);
      const removed = await remove.query(`
        DELETE FROM OrderLineWish WHERE OrderLineId = @LineId
          AND EXISTS (SELECT 1 FROM OrderLine WHERE Id = @LineId AND TableOrderId = @OrderId AND Status = @New AND Quantity = 1);
        DELETE FROM OrderLine
        WHERE Id = @LineId AND TableOrderId = @OrderId AND Status = @New AND Quantity = 1;`);
      if (removed.rowsAffected.at(-1) !== 1) {
        throw new RuleError("Deze regel is net verstuurd. Er is niets weggehaald.");
      }
    });
  }

  saveSend(orderId: number, sentLines: readonly OrderLine[], tickets: readonly Ticket[]): Promise<number[]> {
    return this.database.inTransaction(async (transaction) => {
      await this.#lockOpenOrder(transaction, orderId, "Er is niets verstuurd.");

      const ticketIds: number[] = [];
      const ticketPerStation = new Map<number, number>();
      for (const ticket of tickets) {
        const insertTicket = await this.database.request(
          [
            { name: "OrderId", type: sql.Int, value: orderId },
            { name: "CreatedAt", type: sql.DateTime2, value: ticket.createdAt },
            { name: "Station", type: sql.TinyInt, value: ticket.station },
          ],
          transaction,
        );
        const result = await insertTicket.query(
          "INSERT INTO Ticket (TableOrderId, CreatedAt, Station) OUTPUT INSERTED.Id VALUES (@OrderId, @CreatedAt, @Station)",
        );
        const ticketId = int(firstRow(result.recordset), "Id");
        ticketIds.push(ticketId);
        ticketPerStation.set(ticket.station, ticketId);
      }

      for (const line of sentLines) {
        if (line.id === null) {
          throw new Error(`Line ${line.lineNumber} of order ${orderId} is not stored and cannot be sent.`);
        }
        const update = await this.database.request(
          [
            { name: "Sent", type: sql.TinyInt, value: LineStatus.Sent },
            { name: "New", type: sql.TinyInt, value: LineStatus.New },
            { name: "LineId", type: sql.Int, value: line.id },
            { name: "TicketId", type: sql.Int, value: ticketPerStation.get(line.product.station) ?? null },
          ],
          transaction,
        );
        const result = await update.query(
          "UPDATE OrderLine SET Status = @Sent, TicketId = @TicketId WHERE Id = @LineId AND Status = @New",
        );
        if (result.rowsAffected[0] !== 1) {
          throw new RuleError("Een collega heeft deze regels net verstuurd. Er is geen tweede bon gemaakt.");
        }
      }
      return ticketIds;
    });
  }

  async close(orderId: number, closedAt: Date): Promise<boolean> {
    const request = await this.database.request([
      { name: "ClosedAt", type: sql.DateTime2, value: closedAt },
      { name: "Id", type: sql.Int, value: orderId },
    ]);
    const result = await request.query("UPDATE TableOrder SET ClosedAt = @ClosedAt WHERE Id = @Id AND ClosedAt IS NULL");
    return result.rowsAffected[0] === 1;
  }

  // Locking the order row makes writes on one order wait for each other, so two inserts cannot take
  // the same line number and a colleague cannot close the table halfway through.
  async #lockOpenOrder(transaction: sql.Transaction, orderId: number, consequence: string): Promise<void> {
    const request = await this.database.request([{ name: "Id", type: sql.Int, value: orderId }], transaction);
    const result = await request.query("SELECT ClosedAt FROM TableOrder WITH (UPDLOCK, ROWLOCK) WHERE Id = @Id");
    const row = rows(result.recordset)[0];
    if (row === undefined || nullableDate(row, "ClosedAt") !== null) {
      throw new RuleError(`Een collega heeft deze tafel net gesloten. ${consequence}`);
    }
  }

  async #loadOrders(filter: string, parameters: readonly Parameter[]): Promise<Order[]> {
    const lines = groupBy(await loadOrderLines(this.database, filter, parameters), (loaded) => loaded.orderId);
    const request = await this.database.request(parameters);
    const result = await request.query(`
      SELECT o.Id, o.OpenedAt, o.ClosedAt, d.Id AS TableId, d.Name AS TableName
      FROM TableOrder o
      JOIN DiningTable d ON d.Id = o.DiningTableId
      WHERE ${filter}`);
    return rows(result.recordset).map((row) => {
      const id = int(row, "Id");
      return new Order(
        id,
        new DiningTable(int(row, "TableId"), text(row, "TableName")),
        date(row, "OpenedAt"),
        nullableDate(row, "ClosedAt"),
        (lines.get(id) ?? []).map((loaded) => loaded.line),
      );
    });
  }
}

function firstRow(recordset: unknown): Record<string, unknown> {
  const row = rows(recordset)[0];
  if (row === undefined) {
    throw new Error("The database returned no row for an insert.");
  }
  return row;
}
