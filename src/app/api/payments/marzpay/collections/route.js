import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/server/auth/neon";
import { prisma } from "@/server/db/prisma";
import { createUgandaMobileMoneyCollection } from "@/server/payments/marzpay";
import { syncAuthProfile } from "@/server/auth/sync-profile";

const collectionRequestSchema = z.object({
  productId: z.string().min(1).max(100),
  phoneNumber: z.string().regex(/^\+256\d{9}$/),
});

function isSameOrigin(request) {
  const appBaseUrl = process.env.APP_BASE_URL;
  const origin = request.headers.get("origin");

  if (!appBaseUrl || !origin) {
    return false;
  }

  return new URL(appBaseUrl).origin === origin;
}

function getCallbackUrl() {
  const callbackUrl = process.env.MARZPAY_CALLBACK_URL;

  if (!callbackUrl) {
    throw new Error("MARZPAY_CALLBACK_URL must point to the public webhook endpoint.");
  }

  const url = new URL(callbackUrl);

  if (url.protocol !== "https:") {
    throw new Error("MARZPAY_CALLBACK_URL must use HTTPS.");
  }

  return url.toString();
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to verify the current authentication session.", {
      cause: sessionError,
    });
  }

  if (!session?.user) {
    return Response.json({ error: "Sign in before purchasing a pass." }, { status: 401 });
  }

  await syncAuthProfile(session.user);

  const idempotencyKey = request.headers.get("idempotency-key");
  const parsedIdempotencyKey = z.string().uuid().safeParse(idempotencyKey);

  if (!parsedIdempotencyKey.success) {
    return Response.json(
      { error: "A unique idempotency key is required." },
      { status: 400 },
    );
  }
  const scopedIdempotencyKey = `${session.user.id}:${parsedIdempotencyKey.data}`;

  let body;

  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    throw error;
  }

  const parsedBody = collectionRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      { error: "Choose a valid access pass and enter a +256 mobile number." },
      { status: 400 },
    );
  }

  const callbackUrl = getCallbackUrl();
  const existingPurchase = await prisma.purchase.findFirst({
    where: {
      userId: session.user.id,
      idempotencyKey: scopedIdempotencyKey,
    },
    select: { id: true, status: true },
  });

  if (existingPurchase) {
    return Response.json(
      {
        error: "This purchase request was already received.",
        purchaseId: existingPurchase.id,
        status: existingPurchase.status,
      },
      { status: 409 },
    );
  }

  const [profile, product, pendingPurchases] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { accountStatus: true },
    }),
    prisma.accessProduct.findUnique({
      where: { id: parsedBody.data.productId },
    }),
    prisma.purchase.count({
      where: { userId: session.user.id, status: "PENDING" },
    }),
  ]);

  if (profile?.accountStatus === "SUSPENDED") {
    return Response.json({ error: "This account cannot make purchases." }, { status: 403 });
  }

  if (!product || !product.isAvailable) {
    return Response.json({ error: "This access pass is not currently available." }, { status: 404 });
  }

  if (pendingPurchases >= 3) {
    return Response.json(
      { error: "Resolve an existing pending purchase before starting another." },
      { status: 409 },
    );
  }

  const reference = randomUUID();
  const purchase = await prisma.purchase.create({
    data: {
      userId: session.user.id,
      accessProductId: product.id,
      productName: product.name,
      durationDays: product.durationDays,
      amountUgx: product.priceUgx,
      idempotencyKey: scopedIdempotencyKey,
      transactions: {
        create: {
          provider: "MARZPAY",
          providerReference: reference,
          amountUgx: product.priceUgx,
        },
      },
    },
    include: { transactions: true },
  });

  const transaction = purchase.transactions[0];

  try {
    const collection = await createUgandaMobileMoneyCollection({
      amountUgx: purchase.amountUgx,
      phoneNumber: parsedBody.data.phoneNumber,
      reference,
      callbackUrl,
      purchaseId: purchase.id,
    });

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { providerTransactionId: collection.uuid },
    });

    return Response.json(
      {
        purchaseId: purchase.id,
        status: "PENDING",
        message: "Payment prompt requested. Access is granted only after verification.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("MarzPay collection initiation requires reconciliation.", {
      purchaseId: purchase.id,
      message: error instanceof Error ? error.message : "Unknown provider error",
    });

    return Response.json(
      {
        purchaseId: purchase.id,
        status: "PENDING",
        message:
          "Payment status is not confirmed yet. Check this purchase before attempting another payment.",
      },
      { status: 202 },
    );
  }
}
