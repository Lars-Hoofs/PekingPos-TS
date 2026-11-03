export enum Course {
  Starter = 1,
  Main = 2,
  Dessert = 3,
}

export enum VatRate {
  Low = 9,
  High = 21,
}

export enum LineStatus {
  New = 1,
  Sent = 2,
}

export enum WishKind {
  Remove = 1,
  Add = 2,
}

/** Where a product is made: food in the kitchen, drinks at the bar. Each gets its own tickets. */
export enum Station {
  Kitchen = 1,
  Bar = 2,
}
