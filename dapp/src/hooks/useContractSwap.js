import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'
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

const usdContractSwap = (mode) => {
  const contracts = useStoreState(ContractStore, (s) => s.contracts)

  /* Gives information on suitability of flipper for this swap
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * coinToReceive [string]: Type of coin to receive. One of: 'dai' or 'usdt' or 'usdc'
   */
  const estimateSwapSuitabilityFlipper = async (
    coinToSwap,
    amount,
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

  /* Gives information on suitability of vault mint
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * minMintAmount [BigNumber]: MinMintAmount passed to Vault function of stablecoin to swap
   */
  const estimateMintSuitabilityVault = async (
    coinToSwap,
    amount,
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
    amount,
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
  }
}

export default usdContractSwap
