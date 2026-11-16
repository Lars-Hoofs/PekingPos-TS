import type { NextFunction, Request, Response } from "express";

/**
 * Browsers send an Origin header with every form post. A post from another website has another
 * origin, so it cannot add to an order or close a table (cross-site request forgery).
 */
export function sameOriginPosts(request: Request, response: Response, next: NextFunction): void {
  if (request.method !== "POST") {
    next();
    return;
  }
  const origin = request.get("origin");
  const host = request.get("host");
  if (origin !== undefined && host !== undefined && hostOf(origin) === host) {
    next();
    return;
  }
  response.status(403).type("text/plain").send("Dit formulier komt niet van deze kassa en is niet uitgevoerd.");
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
