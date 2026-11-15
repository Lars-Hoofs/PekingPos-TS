import { OrderLine, SideDish, Wish } from "../domain/index.js";
import type { Database, Parameter } from "./database.js";
import { productColumns, readProduct } from "./productReader.js";
import { bool, int, lineStatus, money, nullableInt, rows, text, vatRate, wishKind } from "./row.js";

export interface LoadedLine {
  orderId: number;
  ticketId: number | null;
  line: OrderLine;
}

/**
 * Loads order lines with their product, side dish and wishes. The filter is a fixed piece of SQL
 * from the repositories; values always go in as parameters.
 */
export async function loadOrderLines(
  database: Database,
  filter: string,
  parameters: readonly Parameter[],
): Promise<LoadedLine[]> {
  const wishes = await loadWishes(database, filter, parameters);
  const request = await database.request(parameters);
  const result = await request.query(`
    SELECT l.Id, l.TableOrderId, l.TicketId, l.LineNumber, l.Quantity, l.UnitPrice, l.VatRate,
           l.SideDishSurcharge, l.Status,
           s.Id AS SideDishId, s.Name AS SideDishName, s.Surcharge, s.IsDefault,
           ${productColumns}
    FROM OrderLine l
    JOIN TableOrder o ON o.Id = l.TableOrderId
    JOIN Product p ON p.Id = l.ProductId
    LEFT JOIN SideDish s ON s.Id = l.SideDishId
    LEFT JOIN Ticket t ON t.Id = l.TicketId
    WHERE ${filter}
    ORDER BY l.TableOrderId, l.LineNumber`);

  return rows(result.recordset).map((row) => {
    const id = int(row, "Id");
    const sideDishId = nullableInt(row, "SideDishId");
    const sideDish =
      sideDishId === null
        ? null
        : new SideDish(sideDishId, text(row, "SideDishName"), money(row, "Surcharge"), bool(row, "IsDefault"));
    const line = OrderLine.restore({
      id,
      product: readProduct(row),
      lineNumber: int(row, "LineNumber"),
      quantity: int(row, "Quantity"),
      unitPrice: money(row, "UnitPrice"),
      vatRate: vatRate(row, "VatRate"),
      sideDish,
      sideDishSurcharge: money(row, "SideDishSurcharge"),
      status: lineStatus(row, "Status"),
      wishes: wishes.get(id) ?? [],
    });
    return { orderId: int(row, "TableOrderId"), ticketId: nullableInt(row, "TicketId"), line };
  });
}

async function loadWishes(
  database: Database,
  filter: string,
  parameters: readonly Parameter[],
): Promise<Map<number, Wish[]>> {
  const request = await database.request(parameters);
  const result = await request.query(`
    SELECT lw.OrderLineId, w.Id, w.Kind, w.Text
    FROM OrderLineWish lw
    JOIN StandardWish w ON w.Id = lw.StandardWishId
    JOIN OrderLine l ON l.Id = lw.OrderLineId
    JOIN TableOrder o ON o.Id = l.TableOrderId
    LEFT JOIN Ticket t ON t.Id = l.TicketId
    WHERE ${filter}
    ORDER BY w.SortOrder`);

  const wishes = new Map<number, Wish[]>();
  for (const row of rows(result.recordset)) {
    const lineId = int(row, "OrderLineId");
    const list = wishes.get(lineId) ?? [];
    list.push(new Wish(int(row, "Id"), wishKind(row, "Kind"), text(row, "Text")));
    wishes.set(lineId, list);
  }
  return wishes;
}
