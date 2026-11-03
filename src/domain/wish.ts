import { WishKind } from "./enums.js";

export class Wish {
  constructor(
    readonly id: number,
    readonly kind: WishKind,
    readonly text: string,
  ) {}

  toTicketText(): string {
    return this.kind === WishKind.Remove ? `− ${this.text}` : `+ ${this.text}`;
  }
}
