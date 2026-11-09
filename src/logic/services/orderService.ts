import { RuleError, Station, type Category, type Order, type OrderLine, type Product, type SideDish, type Wish } from "../../domain/index.js";
import type { Clock } from "../interfaces/clock.js";
import type { MenuRepository } from "../interfaces/menuRepository.js";
import type { OrderRepository } from "../interfaces/orderRepository.js";

export interface AddProductRequest {
  tableId: number;
  productId: number;
  quantity: number;
  /** Null takes the default side dish for a dish that offers one. */
  sideDishId: number | null;
  wishIds: readonly number[];
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly menu: MenuRepository,
    private readonly clock: Clock,
  ) {}

  getCategories(): Promise<Category[]> {
    return this.menu.getCategories();
  }

  getSideDishes(): Promise<SideDish[]> {
    return this.menu.getSideDishes();
  }

  getWishes(): Promise<Wish[]> {
    return this.menu.getWishes();
  }

  async getProduct(productId: number): Promise<Product> {
    const product = await this.menu.getProduct(productId);
    if (product === null) {
      throw new RuleError("Dit product staat niet op de kaart.");
    }
    return product;
  }

  /** The price always comes from the menu, never from the form. */
  async addProduct(request: AddProductRequest): Promise<OrderLine> {
    const order = await this.orders.getOpenOrder(request.tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${request.tableId} is niet open. Er is niets toegevoegd.`);
    }
    const product = await this.getProduct(request.productId);
    const line = order.addLine(product, request.quantity);

    if (product.offersSideDish) {
      line.chooseSideDish(await this.findSideDish(request.sideDishId));
    } else if (request.sideDishId !== null) {
      throw new RuleError(`${product.name} heeft geen bijgerecht.`);
    }

    if (request.wishIds.length > 0) {
      const wishes = await this.menu.getWishes();
      for (const wishId of new Set(request.wishIds)) {
        const wish = wishes.find((w) => w.id === wishId);
        if (wish === undefined) {
          throw new RuleError("Deze wens staat niet in de lijst.");
        }
        line.toggleWish(wish);
      }
    }

    await this.orders.addLine(order.id, line, this.clock.now());
    return line;
  }

  /** One more of a drink on the table, straight from the tile. */
  async addDrink(tableId: number, productId: number): Promise<Product> {
    const { order, drink } = await this.#orderAndDrink(tableId, productId, "Er is niets toegevoegd.");
    const { line, created } = order.addOne(drink);
    if (created) {
      await this.orders.addLine(order.id, line, this.clock.now());
    } else {
      await this.orders.increaseQuantity(order.id, storedId(line));
    }
    return drink;
  }

  /** One less of a drink that is not sent yet. */
  async removeDrink(tableId: number, productId: number): Promise<Product> {
    const { order, drink } = await this.#orderAndDrink(tableId, productId, "Er is niets weggehaald.");
    const { line } = order.removeOne(drink);
    await this.orders.decreaseQuantity(order.id, storedId(line));
    return drink;
  }

  /** Sends the new lines of a table: food to the kitchen, drinks to the bar. Returns the ids of the tickets. */
  async send(tableId: number): Promise<number[]> {
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${tableId} is niet open. Er is niets verstuurd.`);
    }
    const newLines = order.newLines;
    if (newLines.length === 0) {
      return [];
    }
    const tickets = order.send(this.clock.now());
    return this.orders.saveSend(order.id, newLines, tickets);
  }

  async #orderAndDrink(tableId: number, productId: number, consequence: string): Promise<{ order: Order; drink: Product }> {
    const order = await this.orders.getOpenOrder(tableId);
    if (order === null) {
      throw new RuleError(`Tafel ${tableId} is niet open. ${consequence}`);
    }
    const drink = await this.getProduct(productId);
    if (drink.station !== Station.Bar) {
      throw new RuleError(`${drink.name} is geen drank. Kies het als gerecht.`);
    }
    return { order, drink };
  }

  private async findSideDish(sideDishId: number | null): Promise<SideDish> {
    const sideDishes = await this.menu.getSideDishes();
    const sideDish =
      sideDishId === null ? sideDishes.find((s) => s.isDefault) : sideDishes.find((s) => s.id === sideDishId);
    if (sideDish === undefined) {
      throw new RuleError("Dit bijgerecht staat niet in de lijst.");
    }
    return sideDish;
  }
}

/** A line that came from the database always has an id. */
function storedId(line: OrderLine): number {
  if (line.id === null) {
    throw new Error(`Line ${line.lineNumber} is not stored yet.`);
  }
  return line.id;
}
