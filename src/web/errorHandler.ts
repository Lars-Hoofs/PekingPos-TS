import type { NextFunction, Request, Response } from "express";
import { RuleError } from "../domain/index.js";
import { setFlash } from "./flash.js";
import { BadRequestError } from "./input.js";
import { localPath, render } from "./render.js";
import { messagePage } from "./views/pages.js";

export interface ErrorHandlerOptions {
  /** Tells whether an error comes from the database. The data layer knows, the web layer does not. */
  isDatabaseError: (error: unknown) => boolean;
  log: (message: string, error: unknown) => void;
}

/**
 * A broken rule goes back to the page with the message for the staff. A database error goes to a
 * page that says nothing was lost. Anything else is a bug: it is logged and shown as an error page.
 */
export function errorHandler(options: ErrorHandlerOptions) {
  return (error: unknown, request: Request, response: Response, next: NextFunction): void => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const isPost = request.method === "POST";
    const pageUrl = isPost ? refererPath(request) : request.originalUrl;

    if (error instanceof RuleError) {
      setFlash(response, error.message);
      response.redirect(303, isPost ? pageUrl : "/tables");
      return;
    }
    if (error instanceof BadRequestError) {
      render(request, response, messagePage("Ongeldig verzoek", "Deze pagina bestaat niet of de gegevens kloppen niet."), 400);
      return;
    }
    if (options.isDatabaseError(error)) {
      options.log(`Database action failed on ${request.method} ${request.path}`, error);
      const query = new URLSearchParams({ returnUrl: pageUrl, saving: String(isPost) });
      response.redirect(303, `/problem?${query.toString()}`);
      return;
    }
    options.log(`Unexpected error on ${request.method} ${request.path}`, error);
    render(request, response, messagePage("Er ging iets mis", "Deze actie is niet uitgevoerd. Probeer het opnieuw."), 500);
  };
}

function refererPath(request: Request): string {
  const referer = request.get("referer");
  if (referer === undefined) {
    return "/tables";
  }
  try {
    const url = new URL(referer);
    return url.host === request.get("host") ? localPath(url.pathname + url.search, "/tables") : "/tables";
  } catch {
    return "/tables";
  }
}
