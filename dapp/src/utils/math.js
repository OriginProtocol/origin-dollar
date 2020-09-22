export function formatCurrency(value, decimals, truncate = true) {
  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: typeof decimals === 'number' ? decimals : 2,
    maxDecimals: typeof decimals === 'number' ? decimals : 5,
    truncate,
  })
}

export function aprToApy(apr) {
  const periodsPerYear = 365
  return Math.pow(1 + apr / periodsPerYear, periodsPerYear - 1) - 1
}

export function formatCurrencyMinMaxDecimals(
  value,
  { minDecimals, maxDecimals, truncate, floorInsteadOfRound = false }
) {
  if (value === '') {
    return '0.00'
  } else if (Number.isNaN(parseFloat(value))) {
    return '0.00'
  }

  let valueToUse = value
  if (truncate) {
    valueToUse = truncateDecimals(value, maxDecimals)
  } else if (floorInsteadOfRound) {
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

/**
 * Takes a number and truncates decimals values and
 * returns it as a string
 *
 * @param {String|Number} value Value to truncatek
 * @param {Number} decimals Number of decimals to truncate to
 *
 * @returns {String} Truncated decimal value
 */
export function truncateDecimals(value, decimals = 6) {
  if (!value) return
  const [whole, fraction] = value.toString().split('.')

  if (!fraction || fraction.length <= decimals) {
    // No change
    return value.toString()
  }

  // truncate decimals & return
  return `${whole}.${fraction.slice(0, decimals)}`
}
