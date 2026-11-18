import { Router } from "express";
import { id } from "../input.js";
import { render } from "../render.js";
import type { Services } from "../services.js";
import { billPage } from "../views/pages.js";

export function billsRoutes(services: Services): Router {
  const router = Router();

  router.get("/bills/:tableId", async (request, response) => {
    const bill = await services.bills.getBill(id(request.params.tableId, "tableId"));
    render(request, response, billPage(bill, services.clock.now()));
  });

  router.post("/bills/:tableId/close", async (request, response) => {
    await services.tables.closeTable(id(request.params.tableId, "tableId"));
    response.redirect(303, "/tables");
  });

  return router;
}
