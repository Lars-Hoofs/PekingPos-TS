import { Router } from "express";
import { form, id, idList, optionalId, quantity } from "../input.js";
import { render } from "../render.js";
import type { Services } from "../services.js";
import { OrderScreen, parseView, type OrderView } from "../views/orderScreen.js";
import { dishPage, notSentPage, orderPage, sentPage } from "../views/pages.js";

export function ordersRoutes(services: Services): Router {
  const router = Router();

  const screen = async (tableId: number, categoryId: number | null, view: OrderView | null): Promise<OrderScreen> => {
    const [order, categories] = await Promise.all([
      services.tables.getOpenOrder(tableId),
      services.orders.getCategories(),
    ]);
    return new OrderScreen(order, categories, categoryId, view);
  };

  router.get("/orders/:tableId", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const category = optionalId(request.query["category"], "category");
    const view = request.query["view"] === undefined ? null : parseView(request.query["view"]);
    render(request, response, orderPage(await screen(tableId, category, view)));
  });

  router.post("/orders/:tableId/drinks/:productId/plus", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const drink = await services.orders.addDrink(tableId, id(request.params.productId, "productId"));
    response.redirect(303, `/orders/${tableId}?view=drinks&category=${drink.categoryId}`);
  });

  router.post("/orders/:tableId/drinks/:productId/minus", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const drink = await services.orders.removeDrink(tableId, id(request.params.productId, "productId"));
    response.redirect(303, `/orders/${tableId}?view=drinks&category=${drink.categoryId}`);
  });

  router.get("/orders/:tableId/dish/:productId", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const product = await services.orders.getProduct(id(request.params.productId, "productId"));
    if (!product.goesToKitchen) {
      response.redirect(303, `/orders/${tableId}?view=drinks&category=${product.categoryId}`);
      return;
    }
    const [orderScreen, sideDishes, wishes] = await Promise.all([
      screen(tableId, product.categoryId, "food"),
      services.orders.getSideDishes(),
      services.orders.getWishes(),
    ]);
    render(request, response, dishPage(orderScreen, product, sideDishes, wishes));
  });

  router.post("/orders/:tableId/dish/:productId", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const fields = form(request.body);
    const line = await services.orders.addProduct({
      tableId,
      productId: id(request.params.productId, "productId"),
      quantity: quantity(fields["quantity"]),
      sideDishId: optionalId(fields["sideDishId"], "sideDishId"),
      wishIds: idList(fields["wishIds"], "wishIds"),
    });
    response.redirect(303, `/orders/${tableId}?view=food&category=${line.product.categoryId}`);
  });

  router.post("/orders/:tableId/send", async (request, response) => {
    const tableId = id(request.params.tableId, "tableId");
    const ticketIds = await services.orders.send(tableId);
    const query = ticketIds.length === 0 ? "" : `?tickets=${ticketIds.join(",")}`;
    response.redirect(303, `/orders/${tableId}/sent${query}`);
  });

  router.get("/orders/:tableId/sent", async (request, response) => {
    const table = await services.tables.getTable(id(request.params.tableId, "tableId"));
    const raw = request.query["tickets"];
    const ticketIds = typeof raw === "string" && raw !== "" ? idList(raw.split(","), "tickets") : [];
    const tickets = await Promise.all(ticketIds.map((ticketId) => services.tickets.getTicket(ticketId)));
    render(request, response, sentPage(table, tickets));
  });

  router.get("/orders/:tableId/not-sent", async (request, response) => {
    render(request, response, notSentPage(await screen(id(request.params.tableId, "tableId"), null, null)));
  });

  return router;
}
