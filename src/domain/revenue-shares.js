export function calculateShareAmount(grossAmountUgx, percentageBps) {
  if (!Number.isSafeInteger(grossAmountUgx) || grossAmountUgx < 0) {
    throw new Error("Gross amount must be a non-negative whole number.");
  }

  if (
    !Number.isSafeInteger(percentageBps) ||
    percentageBps < 0 ||
    percentageBps > 10_000
  ) {
    throw new Error("Share percentage must be between 0 and 100 percent.");
  }

  return Math.floor((grossAmountUgx * percentageBps) / 10_000);
}

export function calculateAvailableShareBalance(
  availableAllocations,
  activePayoutRequests,
) {
  const available = availableAllocations.reduce(
    (total, allocation) => total + allocation.amountUgx,
    0,
  );
  const reserved = activePayoutRequests.reduce(
    (total, request) => total + request.amountUgx,
    0,
  );

  return Math.max(0, available - reserved);
}

export function calculatePayoutRequestAmount(availableBalance, request) {
  if (!Number.isSafeInteger(availableBalance) || availableBalance < 0) {
    throw new Error("Available share balance must be a non-negative whole number.");
  }

  let amountUgx;

  if (request.requestType === "ALL") {
    amountUgx = availableBalance;
  } else if (request.requestType === "PERCENTAGE") {
    if (
      typeof request.percentage !== "number" ||
      !Number.isFinite(request.percentage) ||
      request.percentage <= 0 ||
      request.percentage > 100
    ) {
      throw new Error("Payout percentage must be greater than 0 and at most 100.");
    }

    amountUgx = Math.floor((availableBalance * request.percentage) / 100);
  } else if (request.requestType === "AMOUNT") {
    amountUgx = request.amount;
  } else {
    throw new Error("Choose a supported payout request type.");
  }

  if (
    !Number.isSafeInteger(amountUgx) ||
    amountUgx <= 0 ||
    amountUgx > availableBalance
  ) {
    throw new Error("The requested amount exceeds your available share balance.");
  }

  return amountUgx;
}
