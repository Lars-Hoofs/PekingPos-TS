import { Course, DiningTable, Dish, Drink, Money, Order, SideDish, VatRate, Wish, WishKind } from "../../src/domain/index.js";

export const euros = (amount: number): Money => Money.fromEuros(amount);

export const table4 = new DiningTable(4, "4");

export const babiPangang = new Dish(86, "86", "Babi pangang", 9, euros(16.7), VatRate.Low, Course.Main, true);
export const loempia = new Dish(10, "10", "Loempia", 2, euros(5.5), VatRate.Low, Course.Starter, false);
export const cola = new Drink(200, null, "Cola", 15, euros(3), VatRate.Low);
export const beer = new Drink(201, null, "Bier", 15, euros(3), VatRate.High);

export const whiteRice = new SideDish(1, "Witte rijst", euros(0), true);
export const nasi = new SideDish(2, "Nasi", euros(0.5), false);
export const bami = new SideDish(3, "Bami", euros(0.5), false);
export const mihoen = new SideDish(4, "Mihoen", euros(5), false);

export const noOnion = new Wish(1, WishKind.Remove, "ui");
export const noGarlic = new Wish(2, WishKind.Remove, "knoflook");
export const spicy = new Wish(5, WishKind.Add, "pikant");

export const now = new Date("2026-11-14T18:30:00Z");

export const openOrder = (id = 1): Order => new Order(id, table4, now);
