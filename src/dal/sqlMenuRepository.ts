import sql from "mssql";
import { Category, SideDish, Wish, type Product } from "../domain/index.js";
import type { MenuRepository } from "../logic/index.js";
import type { Database } from "./database.js";
import { groupBy } from "./groupBy.js";
import { productColumns, readProduct } from "./productReader.js";
import { bool, int, money, rows, text, wishKind } from "./row.js";

export class SqlMenuRepository implements MenuRepository {
  constructor(private readonly database: Database) {}

  async getCategories(): Promise<Category[]> {
    const productRequest = await this.database.request();
    const products = rows((await productRequest.query(`SELECT ${productColumns} FROM Product p ORDER BY p.Id`)).recordset)
      .map(readProduct);
    const perCategory = groupBy(products, (product) => product.categoryId);

    const categoryRequest = await this.database.request();
    const result = await categoryRequest.query("SELECT Id, Name FROM Category ORDER BY Id");
    return rows(result.recordset).map((row) => {
      const id = int(row, "Id");
      return new Category(id, text(row, "Name"), perCategory.get(id) ?? []);
    });
  }

  async getProduct(productId: number): Promise<Product | null> {
    const request = await this.database.request([{ name: "Id", type: sql.Int, value: productId }]);
    const result = await request.query(`SELECT ${productColumns} FROM Product p WHERE p.Id = @Id`);
    const row = rows(result.recordset)[0];
    return row === undefined ? null : readProduct(row);
  }

  async getSideDishes(): Promise<SideDish[]> {
    const request = await this.database.request();
    const result = await request.query("SELECT Id, Name, Surcharge, IsDefault FROM SideDish ORDER BY Surcharge, Id");
    return rows(result.recordset).map(
      (row) => new SideDish(int(row, "Id"), text(row, "Name"), money(row, "Surcharge"), bool(row, "IsDefault")),
    );
  }

  async getWishes(): Promise<Wish[]> {
    const request = await this.database.request();
    const result = await request.query("SELECT Id, Kind, Text FROM StandardWish ORDER BY SortOrder");
    return rows(result.recordset).map((row) => new Wish(int(row, "Id"), wishKind(row, "Kind"), text(row, "Text")));
  }
}
