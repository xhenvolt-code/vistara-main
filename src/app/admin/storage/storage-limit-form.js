"use client";

import { useActionState } from "react";
import { updateStorageLimit } from "./actions";

export function StorageLimitForm({ currentLimitBytes }) {
  const [state, formAction, isPending] = useActionState(
    updateStorageLimit,
    null,
  );

  return (
    <form action={formAction} className="storage-limit-form">
      <label htmlFor="storage-limit">Application storage limit (bytes)</label>
      <div className="storage-limit-controls">
        <input
          defaultValue={currentLimitBytes}
          id="storage-limit"
          min={1_000_000}
          name="limitBytes"
          required
          step={1}
          type="number"
        />
        <button className="button-primary" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save limit"}
        </button>
      </div>
      <p className="muted">
        This is currently an advisory application limit. Upload endpoints are
        not implemented yet, and direct object-storage writes are not blocked.
      </p>
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
    </form>
  );
}
