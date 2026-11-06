import type { DiningTable } from "./diningTable.js";
import { VatRate } from "./enums.js";
import { Money } from "./money.js";
import type { OrderLine } from "./orderLine.js";

export class Bill {
  readonly #lines: readonly OrderLine[];

  constructor(
    readonly table: DiningTable,
    readonly openedAt: Date,
    lines: readonly OrderLine[],
  ) {
    this.#lines = [...lines];
  }

  get lines(): readonly OrderLine[] {
    return this.#lines;
  }

  total(): Money {
    return this.#lines.reduce((sum, line) => sum.plus(line.price()), Money.zero);
  }

  /** The VAT per rate, both rates always present, low rate first. */
  vatPerRate(): Map<VatRate, Money> {
    const vat = new Map<VatRate, Money>();
    for (const rate of [VatRate.Low, VatRate.High]) {
      const amount = this.#lines
        .filter((line) => line.vatRate === rate)
        .reduce((sum, line) => sum.plus(line.price()), Money.zero);
      vat.set(rate, amount.vatIncluded(rate));
    }
    return vat;
  }

  /** The lines that were not sent to the kitchen or the bar yet. */
  unsentCount(): number {
    return this.#lines.filter((line) => line.isNew).length;
  }
}
