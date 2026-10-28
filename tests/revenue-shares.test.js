import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableShareBalance,
  calculatePayoutRequestAmount,
  calculateShareAmount,
} from "../src/domain/revenue-shares.js";

test("share allocation rounds down to whole UGX", () => {
  assert.equal(calculateShareAmount(10_001, 3_333), 3_333);
  assert.equal(calculateShareAmount(499, 10_000), 499);
});

test("share allocation rejects invalid amounts and percentages", () => {
  assert.throws(() => calculateShareAmount(-1, 1_000), /Gross amount/);
  assert.throws(() => calculateShareAmount(1_000, 10_001), /percentage/);
  assert.throws(() => calculateShareAmount(1.5, 1_000), /Gross amount/);
});

test("available balance excludes allocations marked reinvested and payout reservations", () => {
  const balance = calculateAvailableShareBalance(
    [{ amountUgx: 5_000 }, { amountUgx: 2_500 }],
    [{ amountUgx: 1_000 }, { amountUgx: 500 }],
  );

  assert.equal(balance, 6_000);
});

test("available balance never becomes negative", () => {
  assert.equal(
    calculateAvailableShareBalance(
      [{ amountUgx: 400 }],
      [{ amountUgx: 1_000 }],
    ),
    0,
  );
});

test("payout requests can request all, a percentage, or a specific amount", () => {
  assert.equal(
    calculatePayoutRequestAmount(10_000, { requestType: "ALL" }),
    10_000,
  );
  assert.equal(
    calculatePayoutRequestAmount(10_001, {
      requestType: "PERCENTAGE",
      percentage: 33.33,
    }),
    3_333,
  );
  assert.equal(
    calculatePayoutRequestAmount(10_000, {
      requestType: "AMOUNT",
      amount: 4_000,
    }),
    4_000,
  );
});

test("payout requests reject empty, invalid, or over-balance amounts", () => {
  assert.throws(
    () => calculatePayoutRequestAmount(0, { requestType: "ALL" }),
    /requested amount exceeds/,
  );
  assert.throws(
    () =>
      calculatePayoutRequestAmount(10_000, {
        requestType: "AMOUNT",
        amount: 10_001,
      }),
    /requested amount exceeds/,
  );
  assert.throws(
    () =>
      calculatePayoutRequestAmount(10_000, {
        requestType: "PERCENTAGE",
        percentage: 0,
      }),
    /Payout percentage/,
  );
});
