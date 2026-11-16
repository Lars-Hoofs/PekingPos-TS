import { Course, Station, VatRate, type Bill, type Money, type Ticket, type TicketGroup } from "../domain/index.js";

const receiptWidth = 34;
const restaurantTimeZone = "Europe/Amsterdam";

const amountFormat = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});
const timeFormat = new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: restaurantTimeZone,
});

export function amount(money: Money): string {
  return amountFormat.format(money.toEuros());
}

export function euro(money: Money): string {
  return `€ ${amount(money)}`;
}

/** The time in the restaurant, also when the server runs in another time zone. */
export function time(moment: Date): string {
  return timeFormat.format(moment);
}

export function courseName(course: Course): string {
  switch (course) {
    case Course.Starter:
      return "Voorgerecht";
    case Course.Main:
      return "Hoofdgerecht";
    case Course.Dessert:
      return "Nagerecht";
  }
}

export function stationName(station: Station): string {
  return station === Station.Kitchen ? "Keuken" : "Bar";
}

export function groupName(group: TicketGroup): string {
  return group.course === null ? "Drank" : courseName(group.course);
}

export function vatLabel(rate: VatRate): string {
  return `${rate}%`;
}

export function ticketBody(ticket: Ticket): string {
  const lines = [time(ticket.createdAt)];
  for (const group of ticket.groups()) {
    lines.push("-".repeat(receiptWidth), groupName(group).toLocaleUpperCase("nl-NL"));
    for (const line of group.lines) {
      lines.push(`${line.quantity} x ${line.product.name}`);
      if (line.sideDish !== null) {
        lines.push(`    ${line.sideDish.name}`);
      }
      for (const wish of line.wishes) {
        lines.push(`    ${wish.toTicketText()}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function billBody(bill: Bill): string {
  const lines: string[] = [];
  for (const line of bill.lines) {
    lines.push(...row(`${line.quantity} x ${line.product.name}`, amount(line.price())));
    if (line.sideDish !== null) {
      const surcharge = line.sideDishSurcharge.isZero() ? "" : ` (+${amount(line.sideDishSurcharge)})`;
      lines.push(`    ${line.sideDish.name}${surcharge}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function vatBody(bill: Bill): string {
  return [...bill.vatPerRate()].flatMap(([rate, vat]) => row(`Waarvan btw ${vatLabel(rate)}`, amount(vat))).join("\n") + "\n";
}

export function totalRow(bill: Bill): string {
  return row("TOTAAL", euro(bill.total())).join("\n") + "\n";
}

/** A label left and an amount right on one receipt line. A long label gets a line of its own. */
function row(label: string, value: string): string[] {
  const room = receiptWidth - value.length - 1;
  if (label.length > room) {
    return [label, `${"".padEnd(room)} ${value}`];
  }
  return [`${label.padEnd(room)} ${value}`];
}
