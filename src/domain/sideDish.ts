import type { Money } from "./money.js";

export class SideDish {
  constructor(
    readonly id: number,
    readonly name: string,
    readonly surcharge: Money,
    readonly isDefault: boolean,
  ) {}
}
