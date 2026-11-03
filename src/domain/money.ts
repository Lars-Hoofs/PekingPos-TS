import { VatRate } from "./enums.js";

/**
 * An amount in euro, stored as whole cents. A JavaScript number cannot hold 0.10 exactly,
 * so 3.76 + 0.50 would not always give 4.26. Whole cents always add up exactly.
 */
export class Money {
  static readonly zero = new Money(0);

  readonly #cents: number;

  private constructor(cents: number) {
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError(`An amount must be a whole number of cents, got ${cents}.`);
    }
    this.#cents = cents;
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  /** For amounts that arrive as a decimal number, such as a decimal(6,2) column. */
  static fromEuros(euros: number): Money {
    return new Money(Math.round(euros * 100));
  }

  get cents(): number {
    return this.#cents;
  }

  toEuros(): number {
    return this.#cents / 100;
  }

  plus(other: Money): Money {
    return new Money(this.#cents + other.#cents);
  }

  times(factor: number): Money {
    if (!Number.isInteger(factor)) {
      throw new RangeError(`An amount can only be multiplied by a whole number, got ${factor}.`);
    }
    return new Money(this.#cents * factor);
  }

  isZero(): boolean {
    return this.#cents === 0;
  }

  equals(other: Money): boolean {
    return this.#cents === other.#cents;
  }

  /** The VAT inside a price that includes VAT, rounded to the nearest cent. */
  vatIncluded(rate: VatRate): Money {
    const numerator = this.#cents * rate;
    const denominator = 100 + rate;
    const sign = Math.sign(numerator);
    return new Money(sign * Math.floor((2 * Math.abs(numerator) + denominator) / (2 * denominator)));
  }
}
