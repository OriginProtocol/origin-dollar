import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'

const allContractData = {
  'usdt': {
    decimals: 6
  },
  'dai': {
    decimals: 18
  },
  'usdc': {
    decimals: 6
  },
  'ousd': {
    decimals: 18
  }
}


const usdContractSwap = (mode) => {
  const contracts = useStoreState(ContractStore, (s) => s.contracts)

  /* Gives information on suitability of flipper for this swap
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * coinToReceive [string]: Type of coin to receive. One of: 'dai' or 'usdt' or 'usdc'
   */
  async function estimateSwapSuitabilityFlipper(coinToSwap, amount, coinToReceive) {
    if (amount > 25000) {
      return {
        canDoSwap: false,
        reason: 'amount_too_high'
      }
    }

    const coinToReceiveDecimals = allContractData[coinToReceive].decimals
    const bnAmount = ethers.utils.parseUnits(amount.toString(), coinToReceiveDecimals)

    const contractCoinBalance = await contracts[coinToReceive].balanceOf(contracts.flipper.address)

    if (contractCoinBalance.lt(bnAmount)) {
      return {
        canDoSwap: false,
        reason: 'not_enough_funds_contract'
      }
    }

    return {
      canDoSwap: true,
      gasUsed: 90000,
      amountReceived: amount
    }
  }

  /* Gives information on suitability of vault mint
   *
   * coinToSwap [string]: Type of coin to exchange. One of: 'dai' or 'usdt' or 'usdc'
   * amount [Number]: Amount of stablecoin to swap
   * minMintAmount [BigNumber]: MinMintAmount passed to Vault function of stablecoin to swap
   */
  async function estimateMintSuitabilityVault(coinToSwap, amount, minMintAmount) {
    const absoluteGasLimitBuffer = 20000
    const percentGasLimitBuffer = 0.1
    const mintAddres = contracts[coinToSwap].address

    const gasEstimate = (
      await contracts.vault.estimateGas.mint(
        mintAddres,
        amount,
        minMintAmount
      )
    ).toNumber()

    const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          absoluteGasLimitBuffer,
          gasEstimate * percentGasLimitBuffer
        )
    )

    // 18 decimals denominated BN exchange rate value
    const oracleCoinPrice = await contracts.vault.priceUSDMint(mintAddres)

    return {
      canDoSwap: true,
      gasUsed: gasLimit,
      // TODO: should this be rather done with BigNumbers instead?
      amountReceived: amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))
    }
  }

  /* Gives information on suitability of vault redeem
   *
   * amount [Number]: Amount of stablecoin to swap
   * isRedeemAll [bool]: Is user trying to redeem all ousd
   */
  async function estimateRedeemSuitabilityVault(amount, isRedeemAll) {
    
    return {
      canDoSwap: true,
      gasUsed: gasLimit,
      // TODO: should this be rather done with BigNumbers instead?
      amountReceived: amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))
    }
  }

  return {
    estimateSwapSuitabilityFlipper,
    estimateMintSuitabilityVault,
    estimateRedeemSuitabilityVault
  }
}

export default usdContractSwap
