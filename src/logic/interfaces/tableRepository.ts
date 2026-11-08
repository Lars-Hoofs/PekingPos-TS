import type { DiningTable } from "../../domain/index.js";

export interface TableRepository {
  getTables(): Promise<DiningTable[]>;
  getTable(tableId: number): Promise<DiningTable | null>;
}
