"use client";

import Link from "next/link";
import { useState } from "react";

const pollingIntervalMs = 5_000;
const maximumPollingAttempts = 60;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Vistara could not read the payment response. Try again.");
    }

    throw error;
  }
}

function hasActiveEntitlement(entitlement) {
  if (!entitlement || entitlement.revokedAt) {
    return false;
  }

  const now = Date.now();
  const startsAt = Date.parse(entitlement.startsAt);
  const expiresAt = Date.parse(entitlement.expiresAt);

  return startsAt <= now && expiresAt > now;
}

export function SubscriptionCheckout({ plan, signedIn, checkoutReady }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [purchaseId, setPurchaseId] = useState("");

  async function pollPurchaseStatus(id, attempts) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await wait(pollingIntervalMs);
      }

      const response = await fetch(
        `/api/purchases/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const purchase = await readJson(response);

      if (!response.ok) {
        throw new Error(
          typeof purchase.error === "string"
            ? purchase.error
            : "Unable to verify this payment. Try checking again.",
        );
      }

      if (
        purchase.status === "PAID" &&
        hasActiveEntitlement(purchase.entitlement)
      ) {
        setMessageType("success");
        setMessage(
          `Subscription active until ${new Date(purchase.entitlement.expiresAt).toLocaleString()}. Enjoy watching.`,
        );
        return true;
      }

      if (
        ["FAILED", "CANCELLED", "REFUNDED", "REVERSED"].includes(
          purchase.status,
        )
      ) {
        throw new Error(
          `MarzPay reports this payment as ${purchase.status.toLowerCase()}. No subscription access was granted.`,
        );
      }
    }

    return false;
  }

  async function submitPayment(event) {
    event.preventDefault();

    if (!signedIn || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessageType("status");
    setMessage("Requesting a secure MarzPay mobile-money prompt...");

    try {
      const response = await fetch("/api/payments/marzpay/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          productId: plan.id,
          phoneNumber: phoneNumber.trim(),
        }),
      });
      const result = await readJson(response);

      if (!response.ok && response.status !== 202) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Unable to start the payment. Try again.",
        );
      }

      if (!result.purchaseId) {
        throw new Error("MarzPay did not return a purchase reference. Contact Vistara support before retrying.");
      }

      setPurchaseId(result.purchaseId);
      setMessage(
        "Payment request received. Approve the mobile-money prompt on your phone; Vistara activates the subscription only after MarzPay verifies payment.",
      );

      const paymentConfirmed = await pollPurchaseStatus(
        result.purchaseId,
        maximumPollingAttempts,
      );

      if (!paymentConfirmed) {
        setMessage(
          "Payment is still pending. Approve the prompt, then check its status here. Do not start another payment yet.",
        );
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The payment request could not be completed. Contact Vistara support before retrying.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkPaymentStatus() {
    if (!purchaseId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessageType("status");
    setMessage("Checking the verified MarzPay payment status...");

    try {
      const confirmed = await pollPurchaseStatus(purchaseId, 1);

      if (!confirmed) {
        setMessage(
          "Payment is still pending. Approve the prompt and check again shortly.",
        );
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to verify this payment. Try checking again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <Link className="button-secondary" href="/auth/sign-in">
        Sign in to subscribe
      </Link>
    );
  }

  if (!checkoutReady) {
    return (
      <p className="muted" role="status">
        MarzPay checkout is not ready yet. Vistara needs its provider
        credentials and a public HTTPS payment callback configured.
      </p>
    );
  }

  return (
    <form className="subscription-checkout" onSubmit={submitPayment}>
      <label>
        Uganda mobile number
        <input
          autoComplete="tel"
          inputMode="tel"
          maxLength={13}
          onChange={(event) => setPhoneNumber(event.target.value)}
          pattern="\+256[0-9]{9}"
          placeholder="+2567XXXXXXXX"
          required
          value={phoneNumber}
        />
      </label>
      <button
        className="button-primary"
        disabled={isSubmitting || Boolean(purchaseId)}
        type="submit"
      >
        {isSubmitting
          ? "Waiting for payment..."
          : purchaseId
            ? "Payment requested"
            : "Subscribe with MarzPay"}
      </button>
      <p className="muted">
        A payment prompt will be sent to this number. Your subscription begins
        only after MarzPay confirms payment; it will not renew automatically.
      </p>
      {purchaseId && (
        <button
          className="button-secondary"
          disabled={isSubmitting}
          onClick={checkPaymentStatus}
          type="button"
        >
          Check payment status
        </button>
      )}
      {message && (
        <p
          aria-live="polite"
          className={
            messageType === "error"
              ? "form-error"
              : messageType === "success"
                ? "form-success"
                : "muted"
          }
          role={messageType === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
