//const iterations = 100;
const iterations = 40;
const calculateAmmoIncrease = ({ floorTargetPercent, initialMint, tickSteps }) => {
  // AMMO was acquired at 1:1
  let totalEth = initialMint
  let totalAmmo = initialMint

  const findPriceAtTvls = (tradingPrice, amoTvl, ethTvl) => {
    let floorPrice = tradingPrice * floorTargetPercent

    // Binary search 
    let low = 0
    let high = 20000
    let mid = high / 2
    let liquidityTolerancePct = 0.01

    for (let i = 0; i < iterations; i++) {
      let candidateEthTVL = mid * tradingPrice + ethTvl;
      let candidateAmmoTVL = mid + amoTvl;
      let requiredLiquidityAtFloorPrice = floorPrice * candidateAmmoTVL
      // percentage of ETH TVL the binary search can miss based off of previous cycle TVL
      let liquidityTolerance = ethTvl * liquidityTolerancePct

      // too much candidate liquidity
      if (candidateEthTVL > requiredLiquidityAtFloorPrice + liquidityTolerance) {
        high = mid
        mid = (high + low) / 2
      // too little candidate liquidity
      } else if (candidateEthTVL < requiredLiquidityAtFloorPrice - liquidityTolerance) {
        low = mid
        mid = (high + low) / 2
      // found it
      } else {
        return {
          ethTvl: candidateEthTVL,
          amoTvl: candidateAmmoTVL,
          ammoBought: mid
        };
      }

      if (i == iterations - 1) {
        throw new Error("out of iterations")
      } 
    }

  }

  const log = (price, ethTvl, ammoTvl) => {
    console.log(
      `trading price: ${price.toFixed(2)}`,
      ` floor price: ${(price - 1).toFixed(2)}`,
      ` ethTvl: ${ethTvl.toFixed(2)}`,
      ` ammoTvl: ${ammoTvl.toFixed(2)}`,
    )
  }

  let tickWidth = tickSteps
  for (let price = 2; price <= 10; price += tickWidth) {
    const { ethTvl, amoTvl, ammoBought } = findPriceAtTvls(price, totalAmmo, totalEth)
    log(price, ethTvl, amoTvl)

    totalEth = ethTvl
    totalAmmo = amoTvl
  }
}

calculateAmmoIncrease({ floorTargetPercent: 0.7, initialMint: 1, tickSteps: 0.1 })