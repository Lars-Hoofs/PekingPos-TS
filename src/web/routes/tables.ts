import { Router } from "express";
import { form, id } from "../input.js";
import { render } from "../render.js";
import type { Services } from "../services.js";
import { tablesPage } from "../views/pages.js";

export function tablesRoutes(services: Services): Router {
  const router = Router();

  router.get("/tables", async (request, response) => {
    render(request, response, tablesPage(await services.tables.getOverview()));
  });

  router.post("/tables/open", async (request, response) => {
    const tableId = id(form(request.body)["tableId"], "tableId");
    await services.tables.openTable(tableId);
    response.redirect(303, `/orders/${tableId}`);
  });

  return router;
}
