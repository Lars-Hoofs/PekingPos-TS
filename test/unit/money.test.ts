import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Money, VatRate } from "../../src/domain/index.js";

describe("Money", () => {
  it("adds 3.76 and 0.50 to exactly 4.26", () => {
    assert.equal(Money.fromEuros(3.76).plus(Money.fromEuros(0.5)).cents, 426);
  });

  it("adds ten times 0.10 to exactly 1.00", () => {
    let sum = Money.zero;
    for (let i = 0; i < 10; i++) {
      sum = sum.plus(Money.fromEuros(0.1));
    }
    assert.equal(sum.cents, 100);
  });

  it("refuses a fraction of a cent", () => {
    assert.throws(() => Money.fromCents(1.5), RangeError);
  });

  it("refuses to multiply by a fraction", () => {
    assert.throws(() => Money.fromCents(100).times(1.5), RangeError);
  });

  it("takes 9% VAT out of a price including VAT", () => {
    assert.equal(Money.fromEuros(51.5).vatIncluded(VatRate.Low).cents, 425);
  });

  it("takes 21% VAT out of a price including VAT", () => {
    assert.equal(Money.fromEuros(6).vatIncluded(VatRate.High).cents, 104);
  });

  it("rounds the VAT to the nearest cent", () => {
    // 0.06 at 9% is 0.495 cent of VAT, 0.07 is 0.578 cent.
    assert.equal(Money.fromCents(6).vatIncluded(VatRate.Low).cents, 0);
    assert.equal(Money.fromCents(7).vatIncluded(VatRate.Low).cents, 1);
  });
});
