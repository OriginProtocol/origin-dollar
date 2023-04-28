import moment from 'moment'

const mintAbsoluteGasLimitBuffer = 20000
/* All gas limit buffers are expressed in relative percentages. Meaning a 0.2
 * value will set gasLimit to 120% of the original value.
 */
const mintPercentGasLimitBuffer = 0.1
const redeemPercentGasLimitBuffer = 0.25
const uniswapV2GasLimitBuffer = 0.2
const sushiswapGasLimitBuffer = 0.2
const uniswapV3GasLimitBuffer = 0.2
const curveGasLimitBuffer = 0.1
const approveCoinGasLimits = {
  ousd: 52000,
  dai: 46000,
  usdt: 48900,
  usdc: 60700,
}
const apyDayOptions = [7, 30, 60, 90, 365]
const DEFAULT_SELECTED_APY = 30
const transactionHistoryItemsPerPage = 50
const max_price = 1.2

const burnTimer = () => {
  const burn = moment('2022-10-10T00:00:00.000Z')
  const days = burn.diff(moment(), 'days')
  const seconds = burn.diff(moment(), 'seconds')
  const burnDays = days === 0 ? 1 : days
  return { days: burnDays, seconds: seconds }
}

module.exports = {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
  uniswapV2GasLimitBuffer,
  sushiswapGasLimitBuffer,
  uniswapV3GasLimitBuffer,
  curveGasLimitBuffer,
  approveCoinGasLimits,
  apyDayOptions,
  DEFAULT_SELECTED_APY,
  transactionHistoryItemsPerPage,
  max_price,
  burnTimer,
}
