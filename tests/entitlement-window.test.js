import assert from "node:assert/strict";
import test from "node:test";
import { calculateEntitlementWindow } from "../src/domain/entitlement-window.js";

const day = 24 * 60 * 60 * 1000;

test("a new pass starts now when no pass is active", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = calculateEntitlementWindow(now, null, 3);

  assert.equal(result.startsAt.getTime(), now.getTime());
  assert.equal(result.expiresAt.getTime(), now.getTime() + 3 * day);
});

test("a new pass extends from the latest active expiry", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const currentExpiry = new Date(now.getTime() + 2 * day);
  const result = calculateEntitlementWindow(now, currentExpiry, 7);

  assert.equal(result.startsAt.getTime(), currentExpiry.getTime());
  assert.equal(result.expiresAt.getTime(), currentExpiry.getTime() + 7 * day);
});

test("an expired pass does not delay a new pass", () => {
  const now = new Date("2026-01-03T00:00:00.000Z");
  const expiredAt = new Date(now.getTime() - day);
  const result = calculateEntitlementWindow(now, expiredAt, 1);

  assert.equal(result.startsAt.getTime(), now.getTime());
  assert.equal(result.expiresAt.getTime(), now.getTime() + day);
});

test("pass duration must be a positive integer", () => {
  assert.throws(
    () => calculateEntitlementWindow(new Date(), null, 0),
    /positive whole number/,
  );
  assert.throws(
    () => calculateEntitlementWindow(new Date(), null, 1.5),
    /positive whole number/,
  );
});
