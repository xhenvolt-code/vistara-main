import { processMarzPayCallback } from "@/server/payments/process-marzpay-callback";
import { verifyMarzPaySignature } from "@/server/payments/marzpay";

const maxBodyBytes = 64 * 1024;

async function readBoundedBody(request) {
  const reader = request.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBodyBytes) {
      await reader.cancel();
      throw new RangeError("Webhook payload is too large.");
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return Response.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  let rawBody;

  try {
    rawBody = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return Response.json({ error: error.message }, { status: 413 });
    }

    throw error;
  }

  const signature = request.headers.get("x-marzpay-signature");

  if (
    signature &&
    !verifyMarzPaySignature(
      rawBody,
      request.headers.get("x-marzpay-timestamp"),
      signature,
    )
  ) {
    return Response.json({ error: "Invalid MarzPay signature." }, { status: 401 });
  }

  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Webhook payload must be valid JSON." }, { status: 400 });
    }

    throw error;
  }

  const result = await processMarzPayCallback(payload);
  return Response.json({ received: true, status: result.status });
}
