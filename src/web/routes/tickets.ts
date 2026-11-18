import { Router } from "express";
import { Station } from "../../domain/index.js";
import { id } from "../input.js";
import { render } from "../render.js";
import type { Services } from "../services.js";
import { ticketsPage } from "../views/pages.js";

export function ticketsRoutes(services: Services): Router {
  const router = Router();

  router.get("/tickets", async (request, response) => {
    const station = request.query["station"] === "bar" ? Station.Bar : Station.Kitchen;
    render(request, response, ticketsPage(station, await services.tickets.getOpenTickets(station)));
  });

  router.post("/tickets/:ticketId/done", async (request, response) => {
    const ticket = await services.tickets.markDone(id(request.params.ticketId, "ticketId"));
    response.redirect(303, `/tickets?station=${ticket.station === Station.Bar ? "bar" : "kitchen"}`);
  });

  return router;
}
