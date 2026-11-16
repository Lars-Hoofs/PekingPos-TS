/** The request itself is wrong: a missing or malformed value that the pages never send. */
export class BadRequestError extends Error {
  override readonly name = "BadRequestError";
}

const idPattern = /^[1-9]\d{0,8}$/;

export function id(value: unknown, field: string): number {
  if (typeof value !== "string" || !idPattern.test(value)) {
    throw new BadRequestError(`${field} must be a positive whole number.`);
  }
  return Number(value);
}

export function optionalId(value: unknown, field: string): number | null {
  return value === undefined || value === "" ? null : id(value, field);
}

/** A checkbox list: absent, one value or several values. */
export function idList(value: unknown, field: string): number[] {
  if (value === undefined) {
    return [];
  }
  const values: unknown[] = Array.isArray(value) ? value : [value];
  return values.map((v) => id(v, field));
}

/** Not a number gives NaN, so the order can refuse it with the message for the staff. */
export function quantity(value: unknown): number {
  return typeof value === "string" && /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
}

/** The fields of a posted form. Express leaves the body undefined when there is none. */
export function form(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}
