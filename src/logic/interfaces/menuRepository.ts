import type { Category, Product, SideDish, Wish } from "../../domain/index.js";

export interface MenuRepository {
  getCategories(): Promise<Category[]>;
  getProduct(productId: number): Promise<Product | null>;
  getSideDishes(): Promise<SideDish[]>;
  getWishes(): Promise<Wish[]>;
}
