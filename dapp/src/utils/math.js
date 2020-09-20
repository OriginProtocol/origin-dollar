export function formatCurrency(value, decimals) {
  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: decimals || 2,
    maxDecimals: decimals || 5,
  })
}

export function aprToApy(apr) {
  const periodsPerYear = 365
  return Math.pow(1 + apr / periodsPerYear, periodsPerYear - 1) - 1
}

export function formatCurrencyMinMaxDecimals(
  value,
  { minDecimals, maxDecimals, floorInsteadOfRound = false }
) {
  if (value === '') {
    return '0.00'
  } else if (Number.isNaN(parseFloat(value))) {
    return '0.00'
  }

  let valueToUse = value
  if (floorInsteadOfRound) {
    valueToUse =
      Math.floor(parseFloat(value) * Math.pow(10, maxDecimals)) /
      Math.pow(10, maxDecimals)
  }
  const options = {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }

  return parseFloat(valueToUse).toLocaleString('en', options)
}
