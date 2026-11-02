const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateEntitlementWindow(now, currentExpiry, durationDays) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("A valid start time is required.");
  }

  if (!Number.isSafeInteger(durationDays) || durationDays <= 0) {
    throw new RangeError("Subscription duration must be a positive whole number of days.");
  }

  const startsAt =
    currentExpiry instanceof Date &&
    !Number.isNaN(currentExpiry.getTime()) &&
    currentExpiry > now
      ? currentExpiry
      : now;

  return {
    startsAt,
    expiresAt: new Date(startsAt.getTime() + durationDays * millisecondsPerDay),
  };
}

export function calculateTemporaryEntitlementWindow(now, currentExpiry, durationHours) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("A valid start time is required.");
  }

  if (!Number.isSafeInteger(durationHours) || durationHours <= 0) {
    throw new RangeError("Temporary access duration must be a positive whole number of hours.");
  }

  const startsAt =
    currentExpiry instanceof Date &&
    !Number.isNaN(currentExpiry.getTime()) &&
    currentExpiry > now
      ? currentExpiry
      : now;

  return {
    startsAt,
    expiresAt: new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000),
  };
}
