import { html, type SafeHtml } from "../html.js";

export interface Page {
  title: string;
  body: SafeHtml;
  /** For a meta refresh, such as "4" or "5;url=/tables". */
  refresh?: string;
}

export function layout(page: Page, message: string | null): SafeHtml {
  return html`<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${page.refresh === undefined ? null : html`<meta http-equiv="refresh" content="${page.refresh}">`}
  <title>${page.title} · Peking Garden</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/css/site.css">
  <script src="/js/site.js" defer></script>
</head>
<body>
${page.body}
${message === null ? null : html`<div class="melding toast" role="alert"><b>${message}</b></div>`}
</body>
</html>`;
}

export function rail(active: "tables" | null): SafeHtml {
  return html`<aside class="rail">
  <div class="merk"><img class="glyph" src="/icons/logo.svg" alt=""><b>Peking Garden</b></div>
  <nav class="nav">
    <a href="/tables" class="${active === "tables" ? "actief" : ""}"><span>Tafels</span></a>
    <a href="/tickets"><span>Bonnen</span></a>
  </nav>
</aside>`;
}
