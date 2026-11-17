import { Station, VatRate, type Bill, type DiningTable, type Product, type SideDish, type Ticket, type Wish } from "../../domain/index.js";
import type { TableStatus } from "../../logic/index.js";
import { billBody, euro, groupName, stationName, ticketBody, time, totalRow, vatBody } from "../format.js";
import { html } from "../html.js";
import { rail, type Page } from "./layout.js";
import { orderScreen, type OrderScreen } from "./orderScreen.js";

export function tablesPage(tables: readonly TableStatus[]): Page {
  const open = tables.filter((status) => status.isOpen).length;
  return {
    title: "Tafels",
    body: html`<div class="app geen-paneel">
${rail("tables")}
  <main class="mid">
    <div class="pagkop">
      <div><h1>Tafels</h1><p>${open} van de ${tables.length} open</p></div>
    </div>
    <div style="padding:0 20px 14px;flex:1;min-height:0;display:flex;flex-direction:column">
      <div class="zone" style="flex:1;min-height:0">
        <div class="zkop"><span>Restaurant</span><span>tik op een tafel om te bestellen</span></div>
        <form class="grid-t" method="post" action="/tables/open">
          ${tables.map(
            (status) => html`<button type="submit" name="tableId" value="${status.table.id}" class="tafel ${status.isOpen ? "bezet" : "vrij"} ${status.hasNewLines ? "mijn" : ""}">
              <b>Tafel ${status.table.name}</b>
              <span class="st">${status.order === null ? "vrij" : `open sinds ${time(status.order.openedAt)}`}</span>
            </button>`,
          )}
        </form>
      </div>
    </div>
    <div class="tafelbalk">
      <div class="tb"><span class="info"><i>rode rand: er zijn regels die nog niet verstuurd zijn</i></span></div>
    </div>
  </main>
</div>`,
  };
}

export function orderPage(screen: OrderScreen): Page {
  return {
    title: `Tafel ${screen.order.table.name}`,
    body: html`<div class="app">${rail("tables")}${orderScreen(screen)}</div>`,
  };
}

export function dishPage(
  screen: OrderScreen,
  dish: Product,
  sideDishes: readonly SideDish[],
  wishes: readonly Wish[],
): Page {
  const tableId = screen.order.table.id;
  return {
    title: dish.name,
    body: html`<div class="app">${rail("tables")}${orderScreen(screen)}</div>
<div class="sluier"><form class="dlg" method="post" action="/orders/${tableId}/dish/${dish.id}" data-line-form data-price="${dish.price.toEuros()}">
  <h2>${dish.name}</h2>
  <p class="sub">${dish.number} · ${euro(dish.price)}</p>
  ${dish.offersSideDish
    ? html`<div class="veld"><label>Bijgerecht</label>
      <div class="keuzes drie">
        ${sideDishes.map(
          (sideDish) =>
            html`<label class="keuze"><input type="radio" name="sideDishId" value="${sideDish.id}" ${sideDish.isDefault ? html`checked` : null} data-surcharge="${sideDish.surcharge.toEuros()}"><span>${sideDish.name}</span><span class="delta">+ ${euro(sideDish.surcharge)}</span></label>`,
        )}
      </div></div>`
    : null}
  <div class="veld"><label>Wens voor de keuken</label>
    <div class="chips">
      ${wishes.map((wish) => html`<label class="chip"><input type="checkbox" name="wishIds" value="${wish.id}">${wish.toTicketText()}</label>`)}
    </div></div>
  <div class="veld" style="display:flex;align-items:center;justify-content:space-between">
    <div><label style="margin-bottom:4px">Aantal</label><span class="stap" data-stepper><button type="button" data-delta="-1"><img src="/icons/min.svg" alt="min"></button><input class="aantal" name="quantity" value="1" inputmode="numeric" autocomplete="off"><button type="button" class="plus" data-delta="1"><img src="/icons/plus.svg" alt="plus"></button></span></div>
    <div style="text-align:right"><label style="margin-bottom:4px">Regeltotaal</label>
      <span style="font-family:var(--med);font-size:22px;letter-spacing:-.4px" data-line-total>${euro(dish.price)}</span></div></div>
  <div class="acties"><a class="knop leeg" href="/orders/${tableId}?category=${dish.categoryId}">Annuleren</a><button type="submit" class="knop rood">Toevoegen aan de tafel</button></div>
</form></div>`,
  };
}

export function sentPage(table: DiningTable, tickets: readonly Ticket[]): Page {
  return {
    title: "Verstuurd",
    body: html`<div class="app geen-paneel">
${rail("tables")}
  <main class="mid">
    <div class="pagkop">
      <div><h1>Verstuurd</h1><p>Tafel ${table.name}</p></div>
      <div class="rechts"><a class="knop leeg" href="/orders/${table.id}" style="width:auto;padding:9px 14px;font-size:13px">Terug naar de tafel</a>
        <a class="knop leeg" href="/bills/${table.id}" style="width:auto;padding:9px 14px;font-size:13px">Naar de rekening</a>
        <a class="knop rood" href="/tickets" style="width:auto;padding:9px 14px;font-size:13px">Naar de bonnen</a></div>
    </div>
    <div class="bonnen">
      ${tickets.map(
        (ticket) => html`<div><div class="bijschrift">${stationName(ticket.station)}bon · voor de ${stationName(ticket.station).toLowerCase()}</div>
<div class="papier"><b>TAFEL ${ticket.table.name}</b> ${ticketBody(ticket)}</div></div>`,
      )}
      <div style="max-width:260px;align-self:center">
        <div class="melding info" style="margin-top:0">
          ${tickets.length === 0
            ? html`<b>Niets verstuurd</b>
            <span>Er stonden geen nieuwe regels op de tafel.</span>`
            : html`<b>Alleen de nieuwe regels</b>
            <span>Eten gaat naar de keuken, drinken naar de bar. Regels die al verstuurd zijn, komen niet opnieuw mee.</span>`}
        </div>
      </div>
    </div>
  </main>
</div>`,
  };
}

export function notSentPage(screen: OrderScreen): Page {
  const tableId = screen.order.table.id;
  const count = screen.bill.unsentCount();
  return {
    title: "Niet verstuurd",
    body: html`<div class="app">${rail("tables")}${orderScreen(screen)}</div>
<div class="sluier"><div class="dlg smal">
  <h2>Nog niet alles is verstuurd</h2>
  <p class="sub">Tafel ${screen.order.table.name}</p>
  <div class="melding">
    <b>${count} ${count === 1 ? "regel is" : "regels zijn"} nog niet naar de keuken of de bar</b>
    <span>Verstuur ze eerst, of ga door als ze niet meer nodig zijn.</span>
  </div>
  <div class="acties"><a class="knop leeg" href="/bills/${tableId}">Toch naar de rekening</a><form method="post" action="/orders/${tableId}/send"><button type="submit" class="knop rood">Eerst versturen</button></form></div>
</div></div>`,
  };
}

export function billPage(bill: Bill, now: Date): Page {
  const vat = bill.vatPerRate();
  const tableId = bill.table.id;
  const vatRow = (rate: VatRate) => {
    const amount = vat.get(rate);
    return amount === undefined ? null : html`<div class="tot-r"><span>Btw ${rate}%</span><span>${euro(amount)}</span></div>`;
  };
  return {
    title: "Rekening",
    body: html`<div class="app">
${rail("tables")}
  <main class="mid">
    <div class="pagkop"><div><h1>Rekening</h1><p>Tafel ${bill.table.name}</p></div></div>
    <div class="bonnen">
<div class="papier">       PEKING GARDEN
         Stramproy
<b>TAFEL ${bill.table.name}</b>  ${time(now)}
----------------------------------
${billBody(bill)}----------------------------------
<b>${totalRow(bill)}</b>${vatBody(bill)}----------------------------------
      Bedankt en tot ziens</div>
    </div>
  </main>
  <aside class="paneel">
    <div class="tafelkop"><div><h1>Tafel ${bill.table.name}</h1><p>open sinds ${time(bill.openedAt)}</p></div></div>
    <div class="melding info" style="margin-top:0">
      <b>Nog iets bijbestellen?</b>
      <span>Kan gewoon. Voeg het toe op de tafel en print de rekening opnieuw.</span></div>
    <div class="totalen">
      ${vatRow(VatRate.Low)}
      ${vatRow(VatRate.High)}
      <div class="tot-lijn"></div>
      <div class="tot-groot"><span>Totaal</span><b>${euro(bill.total())}</b></div>
      <button type="button" class="knop" style="margin-top:14px" data-print>Rekening printen</button>
      <form method="post" action="/bills/${tableId}/close"><button type="submit" class="knop rood" style="margin-top:8px">Tafel sluiten: gast heeft betaald</button></form>
      <a class="knop leeg" href="/orders/${tableId}" style="margin-top:8px">Terug naar de tafel</a>
    </div>
  </aside>
</div>`,
  };
}

export function ticketsPage(station: Station, tickets: readonly Ticket[]): Page {
  const tab = (s: Station, query: string) =>
    html`<a class="t ${s === station ? "aan" : ""}" href="/tickets?station=${query}">${stationName(s)}</a>`;
  return {
    title: `Bonnen ${stationName(station).toLowerCase()}`,
    refresh: "4",
    body: html`<div class="app vol">
  <main class="mid">
    <div class="pagkop">
      <div><h1>Bonnen ${stationName(station).toLowerCase()}</h1><p>${tickets.length} open</p></div>
      <div class="rechts"><div class="tabs station">${tab(Station.Kitchen, "kitchen")}${tab(Station.Bar, "bar")}</div><a class="knop leeg" href="/tables" style="width:auto;padding:9px 14px;font-size:13px;white-space:nowrap">Naar de tafels</a></div>
    </div>
    ${tickets.length === 0 ? html`<div class="pagkop"><p>Er zijn geen open bonnen.</p></div>` : null}
    <div class="kds">
      ${tickets.map(
        (ticket) => html`<div class="bon">
          <div class="bonkop"><b>Tafel ${ticket.table.name}</b><i>${time(ticket.createdAt)}</i></div>
          ${ticket.groups().map(
            (group) => html`<div class="bijschrift bon-gang">${groupName(group)}</div>
            <ul>
              ${group.lines.map(
                (line) => html`<li><span class="a">${line.quantity}</span><div>${line.product.name}
                  ${line.sideDish === null ? null : html`<span class="bij">${line.sideDish.name}</span>`}
                  ${line.wishes.map((wish) => html`<em>${wish.toTicketText()}</em>`)}
                </div></li>`,
              )}
            </ul>`,
          )}
          <div class="bonvoet"><form method="post" action="/tickets/${ticket.id}/done"><button type="submit" class="knop">Klaar</button></form></div>
        </div>`,
      )}
    </div>
  </main>
</div>`,
  };
}

export function problemPage(saving: boolean, returnUrl: string): Page {
  const title = saving ? "Opslaan mislukt" : "Database niet bereikbaar";
  const page: Page = {
    title,
    body: html`<div class="mid overzicht">
  <div class="status offline"><span class="stip"></span>${saving ? "Opslaan is niet gelukt" : "De database is niet bereikbaar"} · probeer het opnieuw</div>
  <div class="pagkop"><div><h1>${title}</h1></div></div>
  <div style="padding:0 20px;max-width:520px">
    <div class="melding" style="margin-top:0">
      <b>Er is niets verloren</b>
      <span>Wat al is opgeslagen, staat er nog. ${saving ? "Alleen deze actie is niet uitgevoerd." : "Deze pagina probeert het vanzelf opnieuw."}</span>
    </div>
    <div class="acties"><a class="knop rood" href="${returnUrl}">Opnieuw proberen</a></div>
  </div>
</div>`,
  };
  return saving ? page : { ...page, refresh: `5;url=${returnUrl}` };
}

export function messagePage(title: string, text: string): Page {
  return {
    title,
    body: html`<div class="mid overzicht"><div class="pagkop"><div><h1>${title}</h1><p>${text}</p></div></div>
  <div style="padding:0 20px"><a class="knop leeg" href="/tables" style="width:auto">Naar de tafels</a></div></div>`,
  };
}
