"use client";

import { useActionState } from "react";
import {
  requestSharePayout,
  reviewSharePayout,
  saveAdminShare,
  updateAllocationDecision,
} from "./actions";

function ActionMessage({ state }) {
  if (state?.error) {
    return (
      <p aria-live="polite" className="form-error" role="alert">
        {state.error}
      </p>
    );
  }

  if (state?.success) {
    return (
      <p aria-live="polite" className="form-success" role="status">
        {state.success}
      </p>
    );
  }

  return null;
}

export function AdminShareForm({ email, userId, percentageBps }) {
  const [state, formAction, isPending] = useActionState(saveAdminShare, null);

  return (
    <form
      action={formAction}
      className="admin-inline-form"
      onSubmit={(event) => {
        const percentage = new FormData(event.currentTarget).get("percentage");
        if (
          !window.confirm(
            `Set ${email}'s share to ${percentage}% for future verified gross collections? Past allocations will not change.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <label>
        Share (%)
        <input
          defaultValue={(percentageBps / 100).toFixed(2)}
          inputMode="decimal"
          max="100"
          min="0"
          name="percentage"
          required
          step="0.01"
          type="number"
        />
      </label>
      <button className="button-secondary" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save share"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function AllocationDecisionForm({ allocation }) {
  const [state, formAction, isPending] = useActionState(
    updateAllocationDecision,
    null,
  );

  return (
    <form action={formAction} className="admin-inline-form">
      <input name="allocationId" type="hidden" value={allocation.id} />
      <label>
        Your decision
        <select defaultValue={allocation.status} name="status">
          <option value="AVAILABLE">Keep available for payout request</option>
          <option value="REINVESTED">Retain for reinvestment</option>
        </select>
      </label>
      <button className="button-secondary" disabled={isPending} type="submit">
        Save choice
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function SharePayoutRequestForm() {
  const [state, formAction, isPending] = useActionState(
    requestSharePayout,
    null,
  );

  return (
    <form
      action={formAction}
      className="admin-inline-form"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const requestType = data.get("requestType");
        const amount = data.get("amount");
        const percentage = data.get("percentage");
        const description =
          requestType === "ALL"
            ? "request a payout of your full available share balance"
            : requestType === "PERCENTAGE"
              ? `request ${percentage}% of your available share balance`
              : `request a payout of UGX ${Number(amount).toLocaleString("en-UG")}`;

        if (!window.confirm(`Submit ${description}? It requires review and will not trigger a provider transfer.`)) {
          event.preventDefault();
        }
      }}
    >
      <label>
        Request
        <select defaultValue="ALL" name="requestType">
          <option value="ALL">All available share balance</option>
          <option value="PERCENTAGE">A percentage of my balance</option>
          <option value="AMOUNT">A specific UGX amount</option>
        </select>
      </label>
      <label>
        Amount in UGX (for specific amount)
        <input
          defaultValue=""
          inputMode="numeric"
          name="amount"
          step="1"
          type="number"
        />
      </label>
      <label>
        Percentage (for percentage request)
        <input
          defaultValue="100"
          max="100"
          min="0.01"
          name="percentage"
          step="0.01"
          type="number"
        />
      </label>
      <button className="button-primary" disabled={isPending} type="submit">
        {isPending ? "Submitting..." : "Request payout"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function SharePayoutReviewForm({ payout }) {
  const [state, formAction, isPending] = useActionState(
    reviewSharePayout,
    null,
  );

  return (
    <form action={formAction} className="admin-inline-form">
      <input name="requestId" type="hidden" value={payout.id} />
      <label>
        Decision
        <select defaultValue="APPROVED" name="decision">
          {payout.status === "REQUESTED" ? (
            <>
              <option value="APPROVED">Approve request</option>
              <option value="REJECTED">Reject request</option>
            </>
          ) : (
            <>
              <option value="PAID">Record externally paid</option>
              <option value="REJECTED">Reject and release reservation</option>
            </>
          )}
        </select>
      </label>
      {payout.status === "APPROVED" && (
        <label>
          External transfer reference (required to record paid)
          <input maxLength={200} minLength={3} name="externalReference" />
        </label>
      )}
      <label>
        Review note (optional)
        <input maxLength={500} name="reviewNote" />
      </label>
      <button className="button-secondary" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Record decision"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
