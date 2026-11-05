import { LineStatus, type VatRate } from "./enums.js";
import { Money } from "./money.js";
import type { Product } from "./product.js";
import { RuleError } from "./ruleError.js";
import type { SideDish } from "./sideDish.js";
import type { Wish } from "./wish.js";

export interface StoredOrderLine {
  id: number;
  product: Product;
  lineNumber: number;
  quantity: number;
  unitPrice: Money;
  vatRate: VatRate;
  sideDish: SideDish | null;
  sideDishSurcharge: Money;
  status: LineStatus;
  wishes: readonly Wish[];
}

/**
 * One product on an order. The price and VAT rate are copied from the product when the line is
 * made, so a later price change on the menu does not change a bill that is already open.
 */
export class OrderLine {
  static readonly maxQuantity = 99;

  readonly #id: number | null;
  readonly #product: Product;
  readonly #lineNumber: number;
  #quantity: number;
  readonly #unitPrice: Money;
  readonly #vatRate: VatRate;
  #sideDish: SideDish | null;
  #sideDishSurcharge: Money;
  #status: LineStatus;
  readonly #wishes: Wish[];

  private constructor(line: Omit<StoredOrderLine, "id"> & { id: number | null }) {
    this.#id = line.id;
    this.#product = line.product;
    this.#lineNumber = line.lineNumber;
    this.#quantity = line.quantity;
    this.#unitPrice = line.unitPrice;
    this.#vatRate = line.vatRate;
    this.#sideDish = line.sideDish;
    this.#sideDishSurcharge = line.sideDishSurcharge;
    this.#status = line.status;
    this.#wishes = [...line.wishes];
  }

  /** A new line that is not stored yet. Only an order makes these, so it can check the quantity. */
  static create(product: Product, quantity: number, lineNumber: number): OrderLine {
    return new OrderLine({
      id: null,
      product,
      lineNumber,
      quantity,
      unitPrice: product.price,
      vatRate: product.vatRate,
      sideDish: null,
      sideDishSurcharge: Money.zero,
      status: LineStatus.New,
      wishes: [],
    });
  }

  /** A line as it was stored, with the price and VAT rate of the moment it was ordered. */
  static restore(line: StoredOrderLine): OrderLine {
    return new OrderLine(line);
  }

  /** Null until the line is stored. */
  get id(): number | null {
    return this.#id;
  }

  get product(): Product {
    return this.#product;
  }

  get lineNumber(): number {
    return this.#lineNumber;
  }

  get quantity(): number {
    return this.#quantity;
  }

  get unitPrice(): Money {
    return this.#unitPrice;
  }

  get vatRate(): VatRate {
    return this.#vatRate;
  }

  get sideDish(): SideDish | null {
    return this.#sideDish;
  }

  get sideDishSurcharge(): Money {
    return this.#sideDishSurcharge;
  }

  get status(): LineStatus {
    return this.#status;
  }

  get isNew(): boolean {
    return this.#status === LineStatus.New;
  }

  get wishes(): readonly Wish[] {
    return [...this.#wishes];
  }

  chooseSideDish(sideDish: SideDish): void {
    if (!this.#product.offersSideDish) {
      throw new RuleError(`${this.#product.name} heeft geen bijgerecht.`);
    }
    this.#sideDish = sideDish;
    this.#sideDishSurcharge = sideDish.surcharge;
  }

  /** Adds the wish, or takes it off when the line already has it. */
  toggleWish(wish: Wish): void {
    if (!this.#product.acceptsWishes) {
      throw new RuleError(`Bij ${this.#product.name} kan geen wens voor de keuken.`);
    }
    const index = this.#wishes.findIndex((w) => w.id === wish.id);
    if (index === -1) {
      this.#wishes.push(wish);
    } else {
      this.#wishes.splice(index, 1);
    }
  }

  /** One more of the same, as long as the line is not sent. */
  increase(): void {
    this.#assertNew();
    if (this.#quantity >= OrderLine.maxQuantity) {
      throw new RuleError(`Er kunnen niet meer dan ${OrderLine.maxQuantity} ${this.#product.name} op één regel.`);
    }
    this.#quantity++;
  }

  /** One less. A line of one is taken off the order instead, see Order.removeOne. */
  decrease(): void {
    this.#assertNew();
    if (this.#quantity <= 1) {
      throw new Error(`Line ${this.#lineNumber} has quantity ${this.#quantity} and cannot go lower.`);
    }
    this.#quantity--;
  }

  price(): Money {
    return this.#unitPrice.plus(this.#sideDishSurcharge).times(this.#quantity);
  }

  markSent(): void {
    this.#status = LineStatus.Sent;
  }

  #assertNew(): void {
    if (!this.isNew) {
      throw new RuleError(`${this.#product.name} is al verstuurd en kan niet meer veranderen.`);
    }
  }
}
