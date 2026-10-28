"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    null,
  );

  return (
    <form action={formAction} className="auth-form">
      <h1 className="page-title">Reset your password</h1>
      <p className="muted">
        Enter your account email and we’ll send password reset instructions if
        an account is registered.
      </p>
      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      {state?.error && (
        <p aria-live="polite" className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p aria-live="polite" className="form-success" role="status">
          {state.success}
        </p>
      )}
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Sending..." : "Send reset instructions"}
      </button>
    </form>
  );
}
