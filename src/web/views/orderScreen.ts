import { Station, type Bill, type Category, type Order, type Product } from "../../domain/index.js";
import { euro, time } from "../format.js";
import { html, type SafeHtml } from "../html.js";

export type OrderView = "food" | "drinks";

export function parseView(value: unknown): OrderView {
  return value === "drinks" ? "drinks" : "food";
}

/** A category belongs to the drinks when every product in it is made at the bar. */
function viewOf(category: Category): OrderView {
  return category.products.length > 0 && category.products.every((p) => p.station === Station.Bar) ? "drinks" : "food";
}

export class OrderScreen {
  readonly bill: Bill;
  readonly view: OrderView;
  readonly activeCategoryId: number | null;

  constructor(
    readonly order: Order,
    readonly categories: readonly Category[],
    activeCategoryId: number | null,
    view: OrderView | null,
  ) {
    this.bill = order.bill();
    const active = categories.find((c) => c.id === activeCategoryId);
    this.view = view ?? (active === undefined ? "food" : viewOf(active));
    this.activeCategoryId =
      active !== undefined && viewOf(active) === this.view
        ? active.id
        : (categories.find((c) => viewOf(c) === this.view)?.id ?? null);
  }

  categoriesOf(view: OrderView): Category[] {
    return this.categories.filter((category) => viewOf(category) === view);
  }
}

export function orderScreen(screen: OrderScreen): SafeHtml {
  const tableId = screen.order.table.id;
  const viewTab = (view: OrderView, label: string) =>
    html`<a class="t ${screen.view === view ? "aan" : ""}" href="/orders/${tableId}?view=${view}" data-view-tab="${view}">${label}</a>`;

  return html`<main class="mid" data-order-screen data-view="${screen.view}" data-active-category="${screen.activeCategoryId}">
  <div class="topbalk">
    <div class="tabs modus">${viewTab("food", "Eten")}${viewTab("drinks", "Drinken")}</div>
    <div class="zoek"><img class="zoekicoon" src="/icons/zoek.svg" alt=""><input type="search" data-product-search placeholder="Zoeken"><span class="hint">nummer of naam</span></div>
  </div>
  <div class="strook"><div class="kop"><span>Categorieën</span></div>
    <div class="cats">
      ${screen.categories.map((category) => {
        const view = viewOf(category);
        return html`<button type="button" class="cat" data-category="${category.id}" data-category-view="${view}" data-title="${category.name}" ${view === screen.view ? null : html`hidden`}><b>${category.name}</b><span>${category.products.length} producten</span></button>`;
      })}
    </div>
  </div>
  <div class="strook producten">
    <div class="kop"><span data-category-title></span><span data-view-hint>${screen.view === "drinks" ? "tik op + of − om aan te passen" : "tik om toe te voegen"}</span></div>
    <div class="scroll">
      ${screen.categories.map(
        (category) => html`<div class="prods" data-category-pane="${category.id}" data-category-view="${viewOf(category)}" ${category.id === screen.activeCategoryId ? null : html`hidden`}>
          ${category.products.map((product) => (product.station === Station.Bar ? drinkTile(screen, product) : dishTile(tableId, product)))}
        </div>`,
      )}
    </div>
  </div>
</main>
${orderPanel(screen)}`;
}

function dishTile(tableId: number, product: Product): SafeHtml {
  return html`<a class="prod" data-row href="/orders/${tableId}/dish/${product.id}">
    <span class="nr">${product.number}</span><span class="naam">${product.name}</span>
    <span class="voet"><span class="prijs">${euro(product.price)}</span></span>
  </a>`;
}

/** A drink with − and + on the tile itself. Each tap changes the order straight away. */
function drinkTile(screen: OrderScreen, product: Product): SafeHtml {
  const tableId = screen.order.table.id;
  const count = screen.order.newQuantityOf(product.id);
  const action = (step: "plus" | "minus") => `/orders/${tableId}/drinks/${product.id}/${step}`;
  return html`<div class="prod drank ${count > 0 ? "gekozen" : ""}" data-row id="drink-${product.id}" data-live>
    <span class="nr">${product.number}</span><span class="naam">${product.name}</span>
    <span class="voet"><span class="prijs">${euro(product.price)}</span>
      <span class="stap">
        <form method="post" action="${action("minus")}" data-live-form><button type="submit" aria-label="${product.name} min één" ${count === 0 ? html`disabled` : null}><img src="/icons/min.svg" alt=""></button></form>
        <b class="${count === 0 ? "nul" : ""}" aria-live="polite">${count}</b>
        <form method="post" action="${action("plus")}" data-live-form><button type="submit" class="plus" aria-label="${product.name} plus één"><img src="/icons/plus.svg" alt=""></button></form>
      </span>
    </span>
  </div>`;
}

function orderPanel(screen: OrderScreen): SafeHtml {
  const tableId = screen.order.table.id;
  const billUrl = screen.bill.unsentCount() > 0 ? `/orders/${tableId}/not-sent` : `/bills/${tableId}`;
  return html`<aside class="paneel" id="order-panel" data-live>
  <div class="tafelkop"><div><h1>Tafel ${screen.order.table.name}</h1><p>open sinds ${time(screen.order.openedAt)} · ${screen.order.lines.length} regels</p></div></div>
  <div class="regels">
    ${screen.order.lines.map(
      (line) => html`<div class="regel ${line.isNew ? "" : "naarkeuken"}">
        <span class="n">${line.quantity}</span>
        <div class="tekst">
          <b>${line.product.name}</b>
          ${line.sideDish === null ? null : html`<i>${line.sideDish.name}</i>`}
          ${line.wishes.map((wish) => html`<i class="wens">${wish.toTicketText()}</i>`)}
          ${line.isNew ? html`<i class="nieuw">nieuw</i>` : null}
        </div>
        <span class="bedrag">${euro(line.price())}</span>
      </div>`,
    )}
  </div>
  <div class="totalen">
    <div class="tot-lijn"></div>
    <div class="tot-groot"><span>Totaal</span><b>${euro(screen.bill.total())}</b></div>
    ${screen.order.newLines.length > 0
      ? html`<form method="post" action="/orders/${tableId}/send"><button type="submit" class="knop rood" style="margin-top:14px">Versturen</button></form>`
      : null}
    <div class="acties" style="margin-top:8px">
      <a class="knop leeg" href="${billUrl}">Rekening</a>
      <a class="knop leeg" href="/tables">Tafels</a>
    </div>
  </div>
</aside>`;
}
