import type { DiningTable, Order } from "../../domain/index.js";

export class TableStatus {
  constructor(
    readonly table: DiningTable,
    readonly order: Order | null,
  ) {}

  get isOpen(): boolean {
    return this.order !== null;
  }

  get hasNewLines(): boolean {
    return (this.order?.newLines.length ?? 0) > 0;
  }
}
