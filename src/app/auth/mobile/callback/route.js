import {
  createMobileAuthHandoffToken,
  createMobileAuthCodeChallenge,
  encryptMobileAuthSession,
  extractMobileAuthSessionCookie,
  hashMobileAuthSecret,
  mobileAuthCallbackScheme,
} from "@/server/auth/mobile-auth-handoff";
import { auth } from "@/server/auth/neon";
import { prisma } from "@/server/db/prisma";
import { syncAuthProfile } from "@/server/auth/sync-profile";

const statePattern = /^[A-Za-z0-9_-]{43}$/;
const handoffLifetimeMs = 3 * 60 * 1000;

function appCallback(state, values) {
  const callback = new URL(`${mobileAuthCallbackScheme}://auth/callback`);
  callback.searchParams.set("state", state);
  for (const [key, value] of Object.entries(values)) {
    if (value) callback.searchParams.set(key, value);
  }

  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: callback.toString(),
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(request) {
  const callbackUrl = new URL(request.url);
  const state = callbackUrl.searchParams.get("state");
  const codeChallenge = callbackUrl.searchParams.get("code_challenge");
  if (
    !state ||
    !statePattern.test(state) ||
    !codeChallenge ||
    !statePattern.test(codeChallenge)
  ) {
    return Response.json(
      { error: "The mobile sign-in request is invalid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (callbackUrl.searchParams.has("error")) {
    return appCallback(state, { error: "google_sign_in_failed" });
  }

  const { data: session, error } = await auth.getSession();
  if (error) {
    console.error("Mobile Google callback session lookup failed.", {
      message: error.message || "Unknown authentication error",
    });
    return appCallback(state, { error: "google_sign_in_failed" });
  }
  if (!session?.user || !session.session?.expiresAt) {
    return appCallback(state, { error: "google_sign_in_failed" });
  }

  const cookie = extractMobileAuthSessionCookie(
    request.headers.get("cookie"),
  );
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!cookie || !cookieSecret || cookieSecret.length < 32) {
    console.error("Mobile Google callback could not create a session handoff.", {
      hasSessionCookie: Boolean(cookie),
      hasCookieSecret: Boolean(cookieSecret),
    });
    return appCallback(state, { error: "google_sign_in_failed" });
  }

  const now = new Date();
  const sessionExpiresAt = new Date(session.session.expiresAt);
  if (!Number.isFinite(sessionExpiresAt.getTime())) {
    return appCallback(state, { error: "google_sign_in_failed" });
  }
  const expiresAt = new Date(
    Math.min(now.getTime() + handoffLifetimeMs, sessionExpiresAt.getTime()),
  );
  if (expiresAt <= now) {
    return appCallback(state, { error: "google_sign_in_failed" });
  }

  try {
    await syncAuthProfile(session.user);
    await prisma.mobileAuthHandoff.deleteMany({
      where: { expiresAt: { lte: now } },
    });

    const token = createMobileAuthHandoffToken();
    await prisma.mobileAuthHandoff.create({
      data: {
        tokenHash: hashMobileAuthSecret(token),
        stateHash: hashMobileAuthSecret(state),
        proofHash: hashMobileAuthSecret(codeChallenge),
        encryptedSessionCookie: encryptMobileAuthSession(
          { cookie, expiresAt: sessionExpiresAt.toISOString() },
          cookieSecret,
        ),
        expiresAt,
      },
    });

    return appCallback(state, { ticket: token });
  } catch (error) {
    console.error("Mobile Google callback handoff creation failed.", {
      message:
        error instanceof Error ? error.message : "Unknown handoff error",
    });
    return appCallback(state, { error: "google_sign_in_failed" });
  }
}
