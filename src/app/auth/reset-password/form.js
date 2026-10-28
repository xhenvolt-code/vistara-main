"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { useState } from "react";

const authClient = createAuthClient();

export function ResetPasswordForm({ token }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function resetPassword(formData) {
    setError("");
    setIsPending(true);
    const password = formData.get("password");
    const confirmation = formData.get("confirmation");

    if (typeof password !== "string" || password.length < 12) {
      setError("Choose a password with at least 12 characters.");
      setIsPending(false);
      return;
    }

    if (password !== confirmation) {
      setError("The password entries do not match.");
      setIsPending(false);
      return;
    }

    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.");
      setIsPending(false);
      return;
    }

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (resetError) {
        setError(resetError.message || "Unable to reset the password.");
        return;
      }

      router.replace("/auth/sign-in?passwordReset=1");
    } catch (resetError) {
      console.error("Neon Auth password reset failed.", {
        message:
          resetError instanceof Error
            ? resetError.message
            : "Unknown authentication error",
      });
      setError("Unable to reach the password service. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={resetPassword} className="auth-form">
      <h1 className="page-title">Choose a new password</h1>
      <p className="muted">
        Use at least 12 characters to keep your account protected.
      </p>
      <label>
        New password
        <input
          autoComplete="new-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <label>
        Confirm password
        <input
          autoComplete="new-password"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {error && (
        <p aria-live="polite" className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
