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
    percentageVested = parseFloat(duration - durationLeft) / duration
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

  console.log(
    'PERCENTAGE DEBUG: ',
    stake.amount,
    percentageVested,
    Math.max(Math.min(1, percentageVested), 0),
    duration,
    durationLeft,
    end,
    Date.now()
  )

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
    // keep the number between 0 and 1
    percentageVested: Math.max(Math.min(1, percentageVested), 0),
    interest,
    durationDays: durationToDays(duration),
    total: parseFloat(stake.amount) + interest,
  }
}
