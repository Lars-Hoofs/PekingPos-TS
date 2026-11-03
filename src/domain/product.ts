import { Station, type Course, type VatRate } from "./enums.js";
import type { Money } from "./money.js";

/**
 * Something on the menu. A subclass says what kind of product it is, so an order line
 * asks the product what is allowed instead of checking which class it is.
 */
export abstract class Product {
  constructor(
    readonly id: number,
    readonly number: string | null,
    readonly name: string,
    readonly categoryId: number,
    readonly price: Money,
    readonly vatRate: VatRate,
  ) {}

  /** The course on the kitchen ticket, or null when the product does not go to the kitchen. */
  abstract get course(): Course | null;

  abstract get station(): Station;

  abstract get offersSideDish(): boolean;

  abstract get acceptsWishes(): boolean;

  get goesToKitchen(): boolean {
    return this.station === Station.Kitchen;
  }
}

export class Dish extends Product {
  readonly #course: Course;
  readonly #offersSideDish: boolean;

  constructor(
    id: number,
    number: string | null,
    name: string,
    categoryId: number,
    price: Money,
    vatRate: VatRate,
    course: Course,
    offersSideDish: boolean,
  ) {
    super(id, number, name, categoryId, price, vatRate);
    this.#course = course;
    this.#offersSideDish = offersSideDish;
  }

  override get course(): Course {
    return this.#course;
  }

  override get station(): Station {
    return Station.Kitchen;
  }

  override get offersSideDish(): boolean {
    return this.#offersSideDish;
  }

  override get acceptsWishes(): boolean {
    return true;
  }
}

export class Drink extends Product {
  override get course(): null {
    return null;
  }

  override get station(): Station {
    return Station.Bar;
  }

  override get offersSideDish(): boolean {
    return false;
  }

  override get acceptsWishes(): boolean {
    return false;
  }
}
