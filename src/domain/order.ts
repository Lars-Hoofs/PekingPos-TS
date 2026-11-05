import { Bill } from "./bill.js";
import type { DiningTable } from "./diningTable.js";
import { OrderLine } from "./orderLine.js";
import type { Product } from "./product.js";
import { RuleError } from "./ruleError.js";
import { Station } from "./enums.js";
import { Ticket } from "./ticket.js";

/** Everything one table orders during one visit. It ends when the table is closed. */
export class Order {
  static readonly maxQuantity = OrderLine.maxQuantity;

  readonly #lines: OrderLine[];
  #closedAt: Date | null;

  constructor(
    readonly id: number,
    readonly table: DiningTable,
    readonly openedAt: Date,
    closedAt: Date | null = null,
    lines: readonly OrderLine[] = [],
  ) {
    this.#closedAt = closedAt;
    this.#lines = [...lines];
  }

  get lines(): readonly OrderLine[] {
    return [...this.#lines];
  }

  get closedAt(): Date | null {
    return this.#closedAt;
  }

  get isClosed(): boolean {
    return this.#closedAt !== null;
  }

  get newLines(): readonly OrderLine[] {
    return this.#lines.filter((line) => line.isNew);
  }

  addLine(product: Product, quantity: number): OrderLine {
    if (this.isClosed) {
      throw new RuleError(`Tafel ${this.table.name} is gesloten. Er is niets toegevoegd.`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Order.maxQuantity) {
      throw new RuleError(`Het aantal moet tussen 1 en ${Order.maxQuantity} liggen. Er is niets toegevoegd.`);
    }
    const lineNumber = Math.max(0, ...this.#lines.map((line) => line.lineNumber)) + 1;
    const line = OrderLine.create(product, quantity, lineNumber);
    this.#lines.push(line);
    return line;
  }

  /**
   * One more of a product without choices, such as a drink. A new line of the same product gets one
   * more; otherwise a line of one is added. Returns the line and whether it is a new line.
   */
  addOne(product: Product): { line: OrderLine; created: boolean } {
    const line = this.#lastNewLineOf(product);
    if (line === undefined || line.sideDish !== null || line.wishes.length > 0) {
      return { line: this.addLine(product, 1), created: true };
    }
    line.increase();
    return { line, created: false };
  }

  /**
   * One less of a product that is not sent yet. A line of one is taken off the order.
   * Returns the line and whether it was taken off.
   */
  removeOne(product: Product): { line: OrderLine; removed: boolean } {
    const line = this.#lastNewLineOf(product);
    if (line === undefined) {
      throw new RuleError(`Er staat geen nieuwe ${product.name} op tafel ${this.table.name}.`);
    }
    if (line.quantity > 1) {
      line.decrease();
      return { line, removed: false };
    }
    this.#lines.splice(this.#lines.indexOf(line), 1);
    return { line, removed: true };
  }

  /** How many of the product are on the order and not sent yet. */
  newQuantityOf(productId: number): number {
    return this.#lines
      .filter((line) => line.isNew && line.product.id === productId)
      .reduce((sum, line) => sum + line.quantity, 0);
  }

  /**
   * Marks every new line as sent. Returns a ticket per station that has new lines: the food for
   * the kitchen and the drinks for the bar. Empty when nothing was new.
   */
  send(now: Date): Ticket[] {
    const newLines = this.newLines;
    for (const line of newLines) {
      line.markSent();
    }
    return [Station.Kitchen, Station.Bar]
      .map((station) => ({ station, lines: newLines.filter((line) => line.product.station === station) }))
      .filter((part) => part.lines.length > 0)
      .map((part) => Ticket.forStation(part.station, null, this.table, now, null, part.lines));
  }

  bill(): Bill {
    return new Bill(this.table, this.openedAt, this.#lines);
  }

  #lastNewLineOf(product: Product): OrderLine | undefined {
    return this.#lines.findLast((line) => line.isNew && line.product.id === product.id);
  }

  close(now: Date): void {
    if (this.isClosed) {
      throw new RuleError(`Tafel ${this.table.name} is al vrij.`);
    }
    this.#closedAt = now;
  }
}
