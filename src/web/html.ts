/** HTML that is already safe to put in a page. Everything else is escaped. */
export class SafeHtml {
  constructor(readonly value: string) {}

  toString(): string {
    return this.value;
  }
}

export type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

/**
 * Template tag for pages. Every value is escaped, so text from the database or the form can
 * never become a script on the page. `false`, null and undefined render nothing.
 */
export function html(strings: TemplateStringsArray, ...values: readonly HtmlValue[]): SafeHtml {
  let out = strings[0] ?? "";
  values.forEach((value, i) => {
    out += render(value) + (strings[i + 1] ?? "");
  });
  return new SafeHtml(out);
}

function render(value: HtmlValue): string {
  if (value instanceof SafeHtml) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(render).join("");
  }
  if (value === null || value === undefined || value === false || value === true) {
    return "";
  }
  return escapeHtml(String(value));
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
