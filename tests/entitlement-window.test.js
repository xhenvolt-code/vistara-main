import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEntitlementWindow,
  calculateTemporaryEntitlementWindow,
} from "../src/domain/entitlement-window.js";

const day = 24 * 60 * 60 * 1000;

test("a new subscription starts now when no entitlement is active", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = calculateEntitlementWindow(now, null, 3);

  assert.equal(result.startsAt.getTime(), now.getTime());
  assert.equal(result.expiresAt.getTime(), now.getTime() + 3 * day);
});

test("a new subscription extends from the latest active expiry", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const currentExpiry = new Date(now.getTime() + 2 * day);
  const result = calculateEntitlementWindow(now, currentExpiry, 7);

  assert.equal(result.startsAt.getTime(), currentExpiry.getTime());
  assert.equal(result.expiresAt.getTime(), currentExpiry.getTime() + 7 * day);
});

test("an expired subscription does not delay a new one", () => {
  const now = new Date("2026-01-03T00:00:00.000Z");
  const expiredAt = new Date(now.getTime() - day);
  const result = calculateEntitlementWindow(now, expiredAt, 1);

  assert.equal(result.startsAt.getTime(), now.getTime());
  assert.equal(result.expiresAt.getTime(), now.getTime() + day);
});

test("subscription duration must be a positive integer", () => {
  assert.throws(
    () => calculateEntitlementWindow(new Date(), null, 0),
    /positive whole number/,
  );
  assert.throws(
    () => calculateEntitlementWindow(new Date(), null, 1.5),
    /positive whole number/,
  );
});

test("temporary access extends from the latest active entitlement in hours", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const currentExpiry = new Date(now.getTime() + 2 * day);
  const result = calculateTemporaryEntitlementWindow(now, currentExpiry, 12);

  assert.equal(result.startsAt.getTime(), currentExpiry.getTime());
  assert.equal(result.expiresAt.getTime(), currentExpiry.getTime() + 12 * 60 * 60 * 1000);
});

test("temporary access duration must be a positive whole number of hours", () => {
  assert.throws(
    () => calculateTemporaryEntitlementWindow(new Date(), null, 0),
    /positive whole number of hours/,
  );
  assert.throws(
    () => calculateTemporaryEntitlementWindow(new Date(), null, 1.5),
    /positive whole number of hours/,
  );
});
