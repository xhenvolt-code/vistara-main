import assert from "node:assert/strict";
import test from "node:test";
import {
  createMobileAuthHandoffToken,
  createMobileAuthCodeChallenge,
  decryptMobileAuthSession,
  encryptMobileAuthSession,
  extractMobileAuthSessionCookie,
  hashMobileAuthSecret,
} from "../src/server/auth/mobile-auth-handoff.js";

test("mobile auth handoff tokens are random URL-safe secrets", () => {
  const first = createMobileAuthHandoffToken();
  const second = createMobileAuthHandoffToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.notEqual(hashMobileAuthSecret(first), first);
});

test("mobile auth handoff proof uses a URL-safe SHA-256 challenge", () => {
  assert.match(
    createMobileAuthCodeChallenge("verifier-value"),
    /^[A-Za-z0-9_-]{43}$/,
  );
  assert.notEqual(
    createMobileAuthCodeChallenge("first-verifier"),
    createMobileAuthCodeChallenge("second-verifier"),
  );
});

test("only the Neon session cookie is extracted for mobile handoff", () => {
  const cookie = extractMobileAuthSessionCookie(
    "other=ignored; __Secure-neon-auth.session_token=session%3Dtoken; tail=ignored",
  );

  assert.equal(
    cookie,
    "__Secure-neon-auth.session_token=session%3Dtoken",
  );
  assert.equal(extractMobileAuthSessionCookie("other=ignored"), null);
});

test("mobile auth session handoffs are encrypted and authenticated", () => {
  const secret = "a-session-encryption-secret-that-is-long-enough";
  const session = {
    cookie: "__Secure-neon-auth.session_token=session-token",
    expiresAt: "2026-11-09T12:00:00.000Z",
  };
  const encrypted = encryptMobileAuthSession(session, secret);

  assert.notEqual(encrypted, JSON.stringify(session));
  assert.deepEqual(decryptMobileAuthSession(encrypted, secret), session);
  assert.throws(() => decryptMobileAuthSession(encrypted, `${secret}x`));
});
