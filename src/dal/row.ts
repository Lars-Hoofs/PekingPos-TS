import { Course, LineStatus, Money, Station, VatRate, WishKind } from "../domain/index.js";

/** A row from SQL Server. The values are checked before they reach the domain. */
export type Row = Record<string, unknown>;

export function rows(recordset: unknown): Row[] {
  if (!Array.isArray(recordset)) {
    throw new TypeError("The database returned no rows where rows were expected.");
  }
  return recordset as Row[];
}

export function int(row: Row, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`Column ${column} should be a whole number, got ${typeof value}.`);
  }
  return value;
}

export function nullableInt(row: Row, column: string): number | null {
  return row[column] === null ? null : int(row, column);
}

export function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new TypeError(`Column ${column} should be text, got ${typeof value}.`);
  }
  return value;
}

export function nullableText(row: Row, column: string): string | null {
  return row[column] === null ? null : text(row, column);
}

export function bool(row: Row, column: string): boolean {
  const value = row[column];
  if (typeof value !== "boolean") {
    throw new TypeError(`Column ${column} should be a bit, got ${typeof value}.`);
  }
  return value;
}

export function date(row: Row, column: string): Date {
  const value = row[column];
  if (!(value instanceof Date)) {
    throw new TypeError(`Column ${column} should be a date, got ${typeof value}.`);
  }
  return value;
}

export function nullableDate(row: Row, column: string): Date | null {
  return row[column] === null ? null : date(row, column);
}

export function money(row: Row, column: string): Money {
  const value = row[column];
  if (typeof value !== "number") {
    throw new TypeError(`Column ${column} should be an amount, got ${typeof value}.`);
  }
  return Money.fromEuros(value);
}

function oneOf<T extends number>(row: Row, column: string, allowed: readonly T[]): T {
  const value = int(row, column);
  const match = allowed.find((a) => a === value);
  if (match === undefined) {
    throw new TypeError(`Column ${column} has an unknown value ${value}.`);
  }
  return match;
}

export const course = (row: Row, column: string): Course =>
  oneOf(row, column, [Course.Starter, Course.Main, Course.Dessert]);
export const vatRate = (row: Row, column: string): VatRate => oneOf(row, column, [VatRate.Low, VatRate.High]);
export const lineStatus = (row: Row, column: string): LineStatus =>
  oneOf(row, column, [LineStatus.New, LineStatus.Sent]);
export const station = (row: Row, column: string): Station => oneOf(row, column, [Station.Kitchen, Station.Bar]);
export const wishKind = (row: Row, column: string): WishKind => oneOf(row, column, [WishKind.Remove, WishKind.Add]);
