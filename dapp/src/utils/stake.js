export function toHumanReadable(stake) {
  const interest = stake.amount * stake.rate
  return {
    ...stake,
    duration_days: Math.round(stake.duration / (60 * 60 * 1000)),
    interest: interest,
    total: stake.amount + interest,
  }
}
