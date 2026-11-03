import type { Product } from "./product.js";

export class Category {
  readonly #products: readonly Product[];

  constructor(
    readonly id: number,
    readonly name: string,
    products: readonly Product[],
  ) {
    this.#products = [...products];
  }

  get products(): readonly Product[] {
    return this.#products;
  }
}
