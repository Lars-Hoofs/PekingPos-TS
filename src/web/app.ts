import express, { type Express } from "express";
import path from "node:path";
import { errorHandler, type ErrorHandlerOptions } from "./errorHandler.js";
import { localPath, render } from "./render.js";
import { billsRoutes } from "./routes/bills.js";
import { ordersRoutes } from "./routes/orders.js";
import { tablesRoutes } from "./routes/tables.js";
import { ticketsRoutes } from "./routes/tickets.js";
import { sameOriginPosts } from "./sameOrigin.js";
import type { Services } from "./services.js";
import { messagePage, problemPage } from "./views/pages.js";

export interface AppOptions extends ErrorHandlerOptions {
  publicFolder: string;
}

export function createApp(services: Services, options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.static(path.resolve(options.publicFolder), { index: false }));
  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  app.use(sameOriginPosts);

  app.get("/", (_request, response) => {
    response.redirect(303, "/tables");
  });
  app.use(tablesRoutes(services));
  app.use(ordersRoutes(services));
  app.use(billsRoutes(services));
  app.use(ticketsRoutes(services));

  app.get("/problem", (request, response) => {
    const saving = request.query["saving"] === "true";
    render(request, response, problemPage(saving, localPath(request.query["returnUrl"], "/tables")));
  });

  app.use((request, response) => {
    render(request, response, messagePage("Niet gevonden", "Deze pagina bestaat niet."), 404);
  });
  app.use(errorHandler(options));

  return app;
}
