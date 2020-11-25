export function durationToDays(duration) {
  return duration / 24 / 60 / 60 / 1000
}

export function enrichStakeData(stake) {
  const interest = stake.amount * stake.rate
  const end = parseFloat(stake.end) * 1000
  const duration = parseFloat(stake.duration) * 1000

  const hasVested = end < Date.now()
  let daysLeft, hoursLeft, minutesLeft, percentageVested, durationLeft
  if (!hasVested) {
    durationLeft = end - Date.now()
    percentageVested = parseFloat(duration - durationLeft) / duration
    minutesLeft = durationLeft / 1000 / 60
    hoursLeft = minutesLeft / 60
    daysLeft = hoursLeft / 24
  } else {
    percentageVested = 1
    durationLeft = 0
    minutesLeft = 0
    hoursLeft = 0
    daysLeft = 0
  }

  return {
    ...stake,
    end,
    duration,
    hasVested,
    daysLeft,
    hoursLeft,
    minutesLeft,
    durationLeft,
    percentageVested,
    interest,
    durationDays: durationToDays(duration),
    total: parseFloat(stake.amount) + interest,
  }
}
