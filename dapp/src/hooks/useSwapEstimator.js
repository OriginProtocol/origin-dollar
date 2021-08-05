import React from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
} from 'utils/constants'

import ContractStore from 'stores/ContractStore'

const allContractData = {
  usdt: {
    decimals: 6,
  },
  dai: {
    decimals: 18,
  },
  usdc: {
    decimals: 6,
  },
  ousd: {
    decimals: 18,
  },
}

const useSwapEstimator = (mode, selectedCoin, amount) => {
  const contracts = useStoreState(ContractStore, (s) => s.contracts)
  const allowances = useStoreState(AccountStore, (s) => s.allowances)

  /* Gives information on suitability of flipper for this swap
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * coinToReceive [string]: Type of coin to receive. One of: 'dai' or 'usdt' or 'usdc'
   */
  const estimateSwapSuitabilityFlipper = async (
    coinToSwap,
    coinToReceive
  ) => {
    if (amount > 25000) {
      return {
        canDoSwap: false,
        reason: 'amount_too_high',
      }
    }

    const coinToReceiveDecimals = allContractData[coinToReceive].decimals
    const bnAmount = ethers.utils.parseUnits(
      amount.toString(),
      coinToReceiveDecimals
    )

    const contractCoinBalance = await contracts[coinToReceive].balanceOf(
      contracts.flipper.address
    )

    if (contractCoinBalance.lt(bnAmount)) {
      return {
        canDoSwap: false,
        reason: 'not_enough_funds_contract',
      }
    }

    return {
      canDoSwap: true,
      gasUsed: 90000,
      amountReceived: amount,
    }
  }

  /* Gives information on suitability of uniswap for this swap
   *
   */
  const estimateSwapSuitabilityUniswap = async (
    coinToSwap,
    coinToReceive
  ) => {
    const coinToReceiveDecimals = allContractData[coinToReceive].decimals

    // currently we support only direct swap. No reason why not to support multiple swaps in the future.
    if (!['ousd', 'usdt'].includes(coinToSwap) || ['ousd', 'usdt'].includes(coinToReceive)) {
      return {
        canDoSwap: false,
        error: 'unsupported'
      }
    }

    // Uniswap has allowance to spend coin. We don't check if positive amount is large enough
    // since we always approve max_int allowance.
    if (parseFloat(allowances[coinToSwap].uniswapV3Router) > 0) {
      const gasEstimate = (
        await uniV3SwapRouter.estimateGas.exactInputSingle([
          ousd.address,
          usdt.address,
          500, // pre-defined Factory fee for stablecoins
          account, // recipient
          BigNumber.from(Date.now() + 10000), // deadline - 10 seconds from now
          ethers.utils.parseUnits('100', await ousd.decimals()), // amountIn
          //ethers.utils.parseUnits('98', await usdt.decimals()), // amountOutMinimum
          0, // amountOutMinimum
          0 // sqrtPriceLimitX96
        ])
      ).toNumber()

      // return {
      //   canDoSwap: true,
      //   gasUsed: 90000,
      //   amountReceived: amount,
      // }
    } else {
      return {
        canDoSwap: true,
        /* This estimate is over the maximum one appearing on mainnet: https://etherscan.io/tx/0x6b1163b012570819e2951fa95a8287ce16be96b8bf18baefb6e738d448188ed5
         * Swap gas costs are usually between 142k - 162k        
         */ 
        gasUsed: 165000,
        amountReceived: amount,
      }
    }
  }

  /* Gives information on suitability of vault mint
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * minMintAmount [BigNumber]: MinMintAmount passed to Vault function of stablecoin to swap
   */
  const estimateMintSuitabilityVault = async (
    coinToSwap,
    minMintAmount
  ) => {
    const mintAddres = contracts[coinToSwap].address

    const gasEstimate = (
      await contracts.vault.estimateGas.mint(mintAddres, amount, minMintAmount)
    ).toNumber()

    const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )

    // 18 decimals denominated BN exchange rate value
    const oracleCoinPrice = await contracts.vault.priceUSDMint(mintAddres)

    return {
      canDoSwap: true,
      gasUsed: gasLimit,
      // TODO: should this be rather done with BigNumbers instead?
      amountReceived:
        amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18)),
    }
  }

  let redeemFee
  const loadRedeemFee = async () => {
    if (!redeemFee) {
      const redeemFeeBn = await contracts.vault.redeemFeeBps()
      redeemFee = parseFloat(ethers.utils.formatUnits(redeemFeeBn, 4))
    }
  }

  /* Gives information on suitability of vault redeem
   *
   * amount [Number]: Amount of stablecoin to swap
   * isRedeemAll [Boolean]: True when user trying to redeem all ousd
   */
  const estimateRedeemSuitabilityVault = async (
    isRedeemAll,
    minStableCoinsReceivedBN
  ) => {
    const redeemAmount = ethers.utils.parseUnits(amount.toString(), 18)
    await loadRedeemFee()

    let gasEstimate
    try {
      if (isRedeemAll) {
        gasEstimate = (
          await contracts.vault.estimateGas.redeemAll(minStableCoinsReceivedBN)
        ).toNumber()
      } else {
        gasEstimate = (
          await contracts.vault.estimateGas.redeem(
            redeemAmount,
            minStableCoinsReceivedBN
          )
        ).toNumber()
      }
    } catch (e) {
      console.error(`Can not estimate contract call gas used: ${e.message}`)
      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }

    const gasLimit = parseInt(gasEstimate * (1 + redeemPercentGasLimitBuffer))

    const exitFee = amount * redeemFee
    const splitsSum = (await _calculateSplits(amount))
      .map((coin) => parseFloat(coin.amount))
      .reduce((a, b) => a + b, 0)

    return {
      canDoSwap: true,
      gasUsed: gasLimit,
      // TODO: should this be rather done with BigNumbers instead?
      amountReceived: splitsSum - exitFee,
    }
  }

  const _calculateSplits = async (sellAmount) => {
    const calculateIt = async () => {
      try {
        const assetAmounts = await contracts.vault.calculateRedeemOutputs(
          ethers.utils.parseUnits(sellAmount.toString(), 18)
        )

        const assets = await Promise.all(
          (await contracts.vault.getAllAssets()).map(async (address, index) => {
            const coin = Object.keys(contracts).find(
              (coin) =>
                contracts[coin] &&
                contracts[coin].address.toLowerCase() === address.toLowerCase()
            )

            const amount = ethers.utils.formatUnits(
              assetAmounts[index],
              allContractData[coin].decimals
            )

            return {
              coin,
              amount,
            }
          })
        )

        return assets
      } catch (err) {
        console.error(err)
        return {}
      }
    }

    return await calculateIt()
  }

  return {
    estimateSwapSuitabilityFlipper,
    estimateMintSuitabilityVault,
    estimateRedeemSuitabilityVault,
    estimateSwapSuitabilityUniswap,
  }
}

export default useSwapEstimator
