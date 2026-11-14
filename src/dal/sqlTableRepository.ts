import sql from "mssql";
import { DiningTable } from "../domain/index.js";
import type { TableRepository } from "../logic/index.js";
import type { Database } from "./database.js";
import { int, rows, text } from "./row.js";

export class SqlTableRepository implements TableRepository {
  constructor(private readonly database: Database) {}

  async getTables(): Promise<DiningTable[]> {
    const request = await this.database.request();
    const result = await request.query("SELECT Id, Name FROM DiningTable ORDER BY SortOrder");
    return rows(result.recordset).map((row) => new DiningTable(int(row, "Id"), text(row, "Name")));
  }

  async getTable(tableId: number): Promise<DiningTable | null> {
    const request = await this.database.request([{ name: "Id", type: sql.Int, value: tableId }]);
    const result = await request.query("SELECT Id, Name FROM DiningTable WHERE Id = @Id");
    const row = rows(result.recordset)[0];
    return row === undefined ? null : new DiningTable(int(row, "Id"), text(row, "Name"));
  }
}
