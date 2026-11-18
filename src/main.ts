import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.js";
import {
  Database,
  isDatabaseError,
  SqlMenuRepository,
  SqlOrderRepository,
  SqlTableRepository,
  SqlTicketRepository,
} from "./dal/index.js";
import { BillService, OrderService, TableService, TicketService, type Clock } from "./logic/index.js";
import { createApp } from "./web/app.js";

// Composition root: the only place that knows every layer. Here each service gets the
// repositories it needs through its constructor (dependency injection).
const config = readConfig(process.env);
const database = new Database(config.database);
const clock: Clock = { now: () => new Date() };

const tables = new SqlTableRepository(database);
const orders = new SqlOrderRepository(database);
const menu = new SqlMenuRepository(database);
const tickets = new SqlTicketRepository(database);

const app = createApp(
  {
    tables: new TableService(tables, orders, clock),
    orders: new OrderService(orders, menu, clock),
    bills: new BillService(orders),
    tickets: new TicketService(tickets, clock),
    clock,
  },
  {
    publicFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public"),
    isDatabaseError,
    log: (message, error) => console.error(message, error),
  },
);

const server = app.listen(config.port, () => {
  console.log(`Peking Garden runs on http://localhost:${config.port}`);
});

const shutDown = (): void => {
  server.close(() => {
    database.close().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error("Closing the database connection failed", error);
        process.exit(1);
      },
    );
  });
};
process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
