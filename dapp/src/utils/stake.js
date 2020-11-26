import { formatCurrencyMinMaxDecimals } from 'utils/math'

export function durationToDays(duration) {
  return formatCurrencyMinMaxDecimals(duration / 24 / 60 / 60 / 1000, {
    minDecimals: 0,
    maxDecimals: 6,
  })
}

export function formatRate(rate) {
  return formatCurrencyMinMaxDecimals(rate * 100, {
    minDecimals: 0,
    maxDecimals: 1,
  })
}

export function enrichStakeData(stake) {
  const interest = stake.amount * stake.rate
  const end = parseFloat(stake.end) * 1000
  const duration = parseFloat(stake.duration) * 1000

  const hasVested = end < Date.now()
  let daysLeft,
    hoursLeft,
    minutesLeft,
    secondsLeft,
    percentageVested,
    durationLeft
  if (!hasVested) {
    durationLeft = end - Date.now()
    percentageVested = Math.max(
      Math.min(1, parseFloat(duration - durationLeft) / duration),
      0
    )
    secondsLeft = durationLeft / 1000
    minutesLeft = secondsLeft / 60
    hoursLeft = minutesLeft / 60
    daysLeft = hoursLeft / 24
  } else {
    percentageVested = 1
    durationLeft = 0
    minutesLeft = 0
    hoursLeft = 0
    daysLeft = 0
  }

  const interestAccrued = parseFloat(interest) * percentageVested
  const interestRemaining = parseFloat(interest) * (1 - percentageVested)

  return {
    ...stake,
    end,
    startDate: new Date(end - duration),
    endDate: new Date(end),
    duration,
    hasVested,
    daysLeft,
    hoursLeft,
    minutesLeft,
    durationLeft,
    percentageVested,
    interest,
    interestAccrued,
    interestRemaining,
    totalToDate: interestAccrued + parseFloat(stake.amount),
    durationDays: durationToDays(duration),
    total: parseFloat(stake.amount) + interest,
  }
}
