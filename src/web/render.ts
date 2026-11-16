import type { Request, Response } from "express";
import { takeFlash } from "./flash.js";
import { layout, type Page } from "./views/layout.js";

export function render(request: Request, response: Response, page: Page, status = 200): void {
  response.status(status).type("html").send(layout(page, takeFlash(request, response)).value);
}

/** Only a path on this site, so a link in a message can never send the staff to another website. */
export function localPath(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : fallback;
}
