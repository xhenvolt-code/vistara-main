import {
  createMobileAuthCodeChallenge,
  decryptMobileAuthSession,
  hashMobileAuthSecret,
  mobileAuthSessionCookieName,
} from "@/server/auth/mobile-auth-handoff";
import { prisma } from "@/server/db/prisma";

const secretPattern = /^[A-Za-z0-9_-]{43}$/;

function jsonResponse(body, status) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request) {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    return jsonResponse(
      { error: "Mobile authentication is not configured." },
      503,
    );
  }

  let appOrigin;
  try {
    appOrigin = new URL(appBaseUrl).origin;
  } catch {
    return jsonResponse(
      { error: "Mobile authentication is not configured." },
      503,
    );
  }
  if (request.headers.get("origin") !== appOrigin) {
    return jsonResponse({ error: "The sign-in request is not allowed." }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "The sign-in request is invalid." }, 400);
  }

  const { ticket, state, verifier } = body ?? {};
  if (
    typeof ticket !== "string" ||
    !secretPattern.test(ticket) ||
    typeof state !== "string" ||
    !secretPattern.test(state) ||
    typeof verifier !== "string" ||
    !secretPattern.test(verifier)
  ) {
    return jsonResponse({ error: "The sign-in request is invalid." }, 400);
  }

  const now = new Date();
  const tokenHash = hashMobileAuthSecret(ticket);
  const stateHash = hashMobileAuthSecret(state);
  const proofHash = hashMobileAuthSecret(
    createMobileAuthCodeChallenge(verifier),
  );
  const encryptedSessionCookie = await prisma.$transaction(async (transaction) => {
    const handoff = await transaction.mobileAuthHandoff.findUnique({
      where: { tokenHash },
    });
    if (
      !handoff ||
      handoff.stateHash !== stateHash ||
      handoff.proofHash !== proofHash ||
      handoff.expiresAt <= now
    ) {
      return null;
    }

    const claimed = await transaction.mobileAuthHandoff.deleteMany({
      where: {
        tokenHash,
        stateHash,
        proofHash,
        expiresAt: { gt: now },
      },
    });
    if (claimed.count !== 1) return null;

    return handoff.encryptedSessionCookie;
  });

  if (!encryptedSessionCookie) {
    return jsonResponse(
      { error: "This Google sign-in link has expired. Try again." },
      401,
    );
  }

  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!cookieSecret || cookieSecret.length < 32) {
    return jsonResponse(
      { error: "Mobile authentication is not configured." },
      503,
    );
  }

  const handoff = decryptMobileAuthSession(
    encryptedSessionCookie,
    cookieSecret,
  );
  if (
    typeof handoff.cookie !== "string" ||
    !handoff.cookie.startsWith(`${mobileAuthSessionCookieName}=`) ||
    typeof handoff.expiresAt !== "string"
  ) {
    throw new Error("The mobile authentication session handoff is invalid.");
  }

  const expiresAt = new Date(handoff.expiresAt);
  const maxAge = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    return jsonResponse(
      { error: "This Google sign-in session has expired. Try again." },
      401,
    );
  }

  const cookieValue = handoff.cookie.substring(
    handoff.cookie.indexOf("=") + 1,
  );
  if (
    cookieValue.length > 4096 ||
    !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(cookieValue)
  ) {
    throw new Error("The mobile authentication session cookie is invalid.");
  }
  return Response.json(
    { authenticated: true },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Set-Cookie": `${mobileAuthSessionCookieName}=${cookieValue}; Path=/; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
      },
    },
  );
}
