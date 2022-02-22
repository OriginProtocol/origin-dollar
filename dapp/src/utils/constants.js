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

module.exports = {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
  uniswapV2GasLimitBuffer,
  sushiswapGasLimitBuffer,
  uniswapV3GasLimitBuffer,
  curveGasLimitBuffer,
}
