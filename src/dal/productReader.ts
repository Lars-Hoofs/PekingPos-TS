import { Dish, Drink, type Product } from "../domain/index.js";
import { bool, course, int, money, nullableText, text, vatRate, type Row } from "./row.js";

const kindDish = 1;

export const productColumns =
  "p.Id AS ProductId, p.Number, p.Name AS ProductName, p.CategoryId, p.Kind, p.Course, p.Price, " +
  "p.VatRate AS ProductVatRate, p.OffersSideDish";

export function readProduct(row: Row): Product {
  const id = int(row, "ProductId");
  const number = nullableText(row, "Number");
  const name = text(row, "ProductName");
  const categoryId = int(row, "CategoryId");
  const price = money(row, "Price");
  const rate = vatRate(row, "ProductVatRate");

  if (int(row, "Kind") === kindDish) {
    return new Dish(id, number, name, categoryId, price, rate, course(row, "Course"), bool(row, "OffersSideDish"));
  }
  return new Drink(id, number, name, categoryId, price, rate);
}
