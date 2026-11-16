import type { Request, Response } from "express";

const cookieName = "melding";

/** Keeps a message for the next page only, like TempData in ASP.NET. */
export function setFlash(response: Response, message: string): void {
  response.cookie(cookieName, message, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60_000 });
}

export function takeFlash(request: Request, response: Response): string | null {
  const header = request.headers.cookie;
  if (header === undefined) {
    return null;
  }
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  if (pair === undefined) {
    return null;
  }
  response.clearCookie(cookieName, { path: "/" });
  try {
    return decodeURIComponent(pair.slice(cookieName.length + 1));
  } catch {
    // A cookie this application did not write. There is no message to show.
    return null;
  }
}
