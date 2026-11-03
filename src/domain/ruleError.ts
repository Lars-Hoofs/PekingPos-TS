/** A rule of the restaurant was broken. The message is shown to the staff member as it is. */
export class RuleError extends Error {
  override readonly name = "RuleError";
}
