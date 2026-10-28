import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const collectionResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    transaction: z.object({
      uuid: z.string().uuid(),
      reference: z.string().uuid(),
      status: z.string(),
    }),
    redirect_url: z.string().url().optional(),
  }),
});

const transactionResponseSchema = z.object({
  transaction: z.object({
    uuid: z.string().uuid(),
    reference: z.string().uuid(),
    status: z.string(),
    amount: z.object({
      raw: z.number().int(),
      currency: z.string(),
    }),
  }),
});

function getConfig() {
  const { MARZPAY_API_KEY, MARZPAY_API_SECRET, MARZPAY_BASE_URL } = process.env;

  if (!MARZPAY_API_KEY || !MARZPAY_API_SECRET || !MARZPAY_BASE_URL) {
    throw new Error("MarzPay API environment variables are incomplete.");
  }

  const baseUrl = new URL(MARZPAY_BASE_URL);

  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("MARZPAY_BASE_URL must be a credential-free HTTPS URL.");
  }

  return {
    baseUrl,
    authorization: `Basic ${Buffer.from(
      `${MARZPAY_API_KEY}:${MARZPAY_API_SECRET}`,
      "utf8",
    ).toString("base64")}`,
  };
}

function endpointUrl(baseUrl, path) {
  const base = new URL(baseUrl);
  const normalizedBase = base.pathname.endsWith("/")
    ? base
    : new URL(`${base.pathname}/`, base.origin);

  return new URL(path.replace(/^\/+/, ""), normalizedBase);
}

async function requestMarzPay(path, options = {}) {
  const { baseUrl, authorization } = getConfig();
  const response = await fetch(endpointUrl(baseUrl, path), {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(12_000),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`MarzPay request failed with HTTP ${response.status}.`);
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("MarzPay returned an invalid JSON response.");
    }

    throw error;
  }
}

export async function createUgandaMobileMoneyCollection({
  amountUgx,
  phoneNumber,
  reference,
  callbackUrl,
  purchaseId,
}) {
  if (!Number.isSafeInteger(amountUgx) || amountUgx < 500 || amountUgx > 10_000_000) {
    throw new Error("MarzPay Uganda collections must be between UGX 500 and 10,000,000.");
  }

  if (!/^\+256\d{9}$/.test(phoneNumber)) {
    throw new Error("Enter a valid Ugandan mobile number in +256 format.");
  }

  const parsedReference = z.string().uuid().safeParse(reference);
  const parsedCallback = z.string().url().safeParse(callbackUrl);

  if (!parsedReference.success || !parsedCallback.success) {
    throw new Error("MarzPay requires a valid UUID reference and callback URL.");
  }

  const payload = await requestMarzPay("collect-money", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountUgx,
      phone_number: phoneNumber,
      country: "UG",
      reference,
      description: "Vistara access pass",
      callback_url: callbackUrl,
      metadata: [{ purchaseId }],
    }),
  });
  const parsedResponse = collectionResponseSchema.safeParse(payload);

  if (!parsedResponse.success) {
    throw new Error("MarzPay returned an unexpected collection response.");
  }

  if (parsedResponse.data.data.transaction.reference !== reference) {
    throw new Error("MarzPay returned a different payment reference.");
  }

  return parsedResponse.data.data.transaction;
}

export async function getMarzPayTransaction(transactionUuid) {
  const parsedUuid = z.string().uuid().safeParse(transactionUuid);

  if (!parsedUuid.success) {
    throw new Error("A valid MarzPay transaction UUID is required.");
  }

  const payload = await requestMarzPay(
    `transactions/${encodeURIComponent(transactionUuid)}`,
    { method: "GET" },
  );
  const transactionResponse = payload?.data?.transaction
    ? payload.data
    : payload;
  const parsedResponse = transactionResponseSchema.safeParse(transactionResponse);

  if (!parsedResponse.success) {
    throw new Error("MarzPay returned an unexpected transaction status response.");
  }

  return parsedResponse.data.transaction;
}

export function verifyMarzPaySignature(rawBody, timestamp, signatureHeader) {
  const secret = process.env.MARZPAY_WEBHOOK_SECRET;

  if (!secret || !timestamp || !signatureHeader) {
    return false;
  }

  if (!/^\d+$/.test(timestamp)) {
    return false;
  }

  const timestampMilliseconds = Number(timestamp) * 1000;
  const ageMilliseconds = Math.abs(Date.now() - timestampMilliseconds);

  if (!Number.isSafeInteger(timestampMilliseconds) || ageMilliseconds > 5 * 60 * 1000) {
    return false;
  }

  const received = signatureHeader.match(/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/i)?.[1];

  if (!received) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  const actual = Buffer.from(received, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
