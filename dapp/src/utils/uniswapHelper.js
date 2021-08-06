import bn from 'bignumber.js'
import { BigNumber } from 'ethers'

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1, reserve0) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}
