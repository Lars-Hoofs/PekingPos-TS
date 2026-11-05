import { Station, type Course } from "./enums.js";
import type { DiningTable } from "./diningTable.js";
import type { OrderLine } from "./orderLine.js";
import { RuleError } from "./ruleError.js";

/** A part of a ticket. On a kitchen ticket one per course; a bar ticket has one part without a course. */
export interface TicketGroup {
  course: Course | null;
  lines: readonly OrderLine[];
}

/** What one table sent to one station at one moment. */
export abstract class Ticket {
  readonly #lines: readonly OrderLine[];
  #doneAt: Date | null;

  protected constructor(
    readonly id: number | null,
    readonly table: DiningTable,
    readonly createdAt: Date,
    doneAt: Date | null,
    lines: readonly OrderLine[],
  ) {
    const wrongStation = lines.find((line) => line.product.station !== this.station);
    if (wrongStation !== undefined) {
      throw new Error(`${wrongStation.product.name} is made at another station and cannot be on this ticket.`);
    }
    this.#lines = [...lines];
    this.#doneAt = doneAt;
  }

  /** The ticket for the station, so the code that stores or loads tickets does not need to know the subclasses. */
  static forStation(
    station: Station,
    id: number | null,
    table: DiningTable,
    createdAt: Date,
    doneAt: Date | null,
    lines: readonly OrderLine[],
  ): Ticket {
    return station === Station.Kitchen
      ? new KitchenTicket(id, table, createdAt, doneAt, lines)
      : new BarTicket(id, table, createdAt, doneAt, lines);
  }

  abstract get station(): Station;

  abstract groups(): TicketGroup[];

  get lines(): readonly OrderLine[] {
    return this.#lines;
  }

  get doneAt(): Date | null {
    return this.#doneAt;
  }

  markDone(now: Date): void {
    if (this.#doneAt !== null) {
      throw new RuleError("Deze bon is al klaar gemeld.");
    }
    this.#doneAt = now;
  }
}

export class KitchenTicket extends Ticket {
  constructor(id: number | null, table: DiningTable, createdAt: Date, doneAt: Date | null, lines: readonly OrderLine[]) {
    super(id, table, createdAt, doneAt, lines);
  }

  override get station(): Station {
    return Station.Kitchen;
  }

  /** Starters first, then mains, then desserts. Within a course in the order they were added. */
  override groups(): TicketGroup[] {
    const groups = new Map<Course, OrderLine[]>();
    const sorted = [...this.lines].sort((a, b) => courseOf(a) - courseOf(b) || a.lineNumber - b.lineNumber);
    for (const line of sorted) {
      const course = courseOf(line);
      const group = groups.get(course) ?? [];
      group.push(line);
      groups.set(course, group);
    }
    return [...groups].map(([course, lines]) => ({ course, lines }));
  }
}

export class BarTicket extends Ticket {
  constructor(id: number | null, table: DiningTable, createdAt: Date, doneAt: Date | null, lines: readonly OrderLine[]) {
    super(id, table, createdAt, doneAt, lines);
  }

  override get station(): Station {
    return Station.Bar;
  }

  override groups(): TicketGroup[] {
    return this.lines.length === 0 ? [] : [{ course: null, lines: [...this.lines].sort((a, b) => a.lineNumber - b.lineNumber) }];
  }
}

function courseOf(line: OrderLine): Course {
  const course = line.product.course;
  if (course === null) {
    throw new Error(`${line.product.name} has no course.`);
  }
  return course;
}
