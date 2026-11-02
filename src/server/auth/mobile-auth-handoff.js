import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const mobileAuthCallbackScheme = "vistara";
export const mobileAuthSessionCookieName =
  "__Secure-neon-auth.session_token";

function deriveEncryptionKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("The mobile authentication encryption key is invalid.");
  }
  return createHash("sha256")
    .update("vistara-mobile-auth-handoff:v1\0")
    .update(secret)
    .digest();
}

export function createMobileAuthHandoffToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMobileAuthSecret(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createMobileAuthCodeChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function extractMobileAuthSessionCookie(cookieHeader) {
  if (typeof cookieHeader !== "string" || cookieHeader.length > 16_384) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) =>
      cookie.startsWith(`${mobileAuthSessionCookieName}=`),
    );

  if (cookies.length !== 1) return null;
  const value = cookies[0].substring(cookies[0].indexOf("=") + 1);
  if (
    value.length > 4096 ||
    !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(value)
  ) {
    return null;
  }
  return cookies[0];
}

export function encryptMobileAuthSession(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMobileAuthSession(encryptedValue, secret) {
  const [ivValue, tagValue, ciphertextValue, extra] =
    encryptedValue.split(".");
  if (!ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error("The mobile authentication handoff is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext);
}
