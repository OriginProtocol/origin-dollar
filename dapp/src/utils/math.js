import { ethers } from 'ethers'

// use different number of decimals when below or above threshold
export function formatCurrencyConditional(
  value,
  threshold,
  decimalsBeforeThreshold,
  decimalsAfterThreshold
) {
  if (value === '') {
    return '0.00'
  } else if (Number.isNaN(parseFloat(value))) {
    return '0.00'
  }

  const isAboveThreshold = parseFloat(value) > threshold

  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: isAboveThreshold
      ? decimalsAfterThreshold
      : decimalsBeforeThreshold,
    maxDecimals: isAboveThreshold
      ? decimalsAfterThreshold
      : decimalsBeforeThreshold,
    floorInsteadOfRound: true,
  })
}

export function formatCurrencyAbbreviated(num, decimalDigits) {
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'k' },
    { value: 1e6, symbol: 'M' },
  ]
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
  var item = lookup
    .slice()
    .reverse()
    .find(function (item) {
      return num >= item.value
    })
  return item
    ? (num / item.value).toFixed(decimalDigits).replace(rx, '$1') + item.symbol
    : '0'
}

export function formatCurrency(value, decimals, truncate = true) {
  // avoid false formatting of e - notated numbers
  if (value < Math.pow(10, decimals * -1)) {
    value = 0
  }

  return formatCurrencyMinMaxDecimals(value, {
    minDecimals: typeof decimals === 'number' ? decimals : 2,
    maxDecimals: typeof decimals === 'number' ? decimals : 5,
    truncate,
  })
}

export function aprToApy(apr, aprDays) {
  const periodsPerYear = 365.25 / aprDays
  return Math.pow(1 + apr / 100 / periodsPerYear, periodsPerYear) - 1
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
 * @param {String|Number} value Value to truncate
 * @param {Number} decimals Number of decimals to truncate to
 *
 * @returns {String} Truncated decimal value
 */
export function truncateDecimals(value, decimals = 6) {
  if (!value) return value
  const [whole, fraction] = value.toString().split('.')

  if (!fraction || fraction.length <= decimals) {
    // No change
    return value.toString()
  }

  // truncate decimals & return
  return `${whole}.${fraction.slice(0, decimals)}`
}

export async function displayCurrency(balance, contract) {
  if (!balance) return
  return ethers.utils.formatUnits(balance, await contract.decimals())
}

export function calculateSwapAmounts(
  rawInputAmount,
  decimals,
  priceToleranceValue
) {
  const floatAmount = parseFloat(rawInputAmount)
  if (Number.isNaN(floatAmount)) {
    return {}
  }

  const safeFromUnderflowRawAmount = truncateDecimals(rawInputAmount, decimals)

  const swapAmount = ethers.utils.parseUnits(
    safeFromUnderflowRawAmount.toString(),
    decimals
  )

  const selectedCoinAmountWithTolerance =
    Math.floor(
      (floatAmount -
        floatAmount * (priceToleranceValue ? priceToleranceValue / 100 : 0)) *
        100
    ) / 100

  const minSwapAmount = ethers.utils.parseUnits(
    selectedCoinAmountWithTolerance.toString(),
    decimals
  )

  return {
    swapAmount,
    minSwapAmount,
  }
}

export function removeCommas(value) {
  return value.toString().replace(/,/g, '')
}

export function checkValidInputForCoin(amount, coin) {
  if (amount === '') {
    amount = '0.00'
  }

  const COIN = coin.toLowerCase()
  let decimals

  switch (coin) {
    case 'usdc':
      decimals = 6
      break
    case 'usdt':
      decimals = 6
      break
    case 'ousd':
      decimals = 18
      break
    case 'dai':
      decimals = 18
      break
    case 'wousd':
      decimals = 18
      break
    default:
      throw new Error(`Unexpected stablecoin: ${coin}`)
  }

  var regex = new RegExp(
    `^((\\d{1,3})(?:[0-9]{3}){0,1}|(\\d{1})(?:[0-9]{3}){0,2}|(\\d{1,18}))((\\.)|(\\.\\d{1,${decimals}}))?$`,
    'g'
  )
  return regex.test(amount)
}
