import React, { useEffect, useState } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
} from 'utils/constants'
import { find } from 'lodash'

import { calculateSwapAmounts } from 'utils/math'

const useCurrencySwapper = (
  swapMode,
  amountRaw,
  selectedCoin,
  priceToleranceValue
) => {
  const [needsApproval, setNeedsApproval] = useState(false)
  const {
    vault: vaultContract,
    ousd: ousdContract,
    usdt: usdtContract,
    usdc: usdcContract,
    dai: daiContract,
    flipper,
    uniV3SwapRouter,
  } = useStoreState(ContractStore, (s) => s.contracts)

  const coinInfoList = useStoreState(ContractStore, (s) => s.coinInfoList)

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const account = useStoreState(AccountStore, (s) => s.address)
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const bestSwap =
    swapEstimations &&
    typeof swapEstimations === 'object' &&
    find(swapEstimations, (estimation) => estimation.isBest)

  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.ousd &&
    allowances.usdt &&
    allowances.usdc &&
    allowances.dai

  const { contract: coinContract, decimals } = coinInfoList[
    swapMode === 'mint' ? selectedCoin : 'ousd'
  ]
  // plain amount as displayed in UI (not in wei format)
  const amount = parseFloat(amountRaw)

  const { swapAmount, minSwapAmount } = calculateSwapAmounts(
    amountRaw,
    decimals,
    priceToleranceValue
  )

  useEffect(() => {
    if (!amount || !bestSwap || !allowances || Object.keys(allowances) === 0) {
      return
    }

    const nameMaps = {
      vault: 'vault',
      flipper: 'flipper',
      uniswap: 'uniswapV3Router',
    }

    const coinNeedingApproval = swapMode === 'mint' ? selectedCoin : 'ousd'

    setNeedsApproval(
      parseFloat(allowances[coinNeedingApproval][nameMaps[bestSwap.name]]) <
        amount
        ? bestSwap.name
        : false
    )
  }, [swapMode, amount, allowances, selectedCoin, bestSwap])

  const _mintVault = async (
    callObject,
    swapAmount,
    minSwapAmount,
    options = {}
  ) => {
    return await callObject.mint(
      coinContract.address,
      swapAmount,
      minSwapAmount,
      options
    )
  }

  const mintVaultGasEstimate = async (swapAmount, minSwapAmount) => {
    return (
      await _mintVault(vaultContract.estimateGas, swapAmount, minSwapAmount)
    ).toNumber()
  }

  const mintVault = async () => {
    const gasEstimate = await mintVaultGasEstimate(swapAmount, minSwapAmount)
    const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )

    return {
      result: await _mintVault(vaultContract, swapAmount, minSwapAmount, {
        gasLimit,
      }),
      swapAmount,
      minSwapAmount,
    }
  }

  const _redeemVault = async (
    callObject,
    swapAmount,
    minSwapAmount,
    options = {}
  ) => {
    let gasEstimate
    const isRedeemAll = Math.abs(swapAmount - balances.ousd) < 1
    if (isRedeemAll) {
      return await callObject.redeemAll(minSwapAmount)
    } else {
      return await callObject.redeem(swapAmount, minSwapAmount)
    }
  }

  const redeemVaultGasEstimate = async (swapAmount, minSwapAmount) => {
    return (
      await _redeemVault(vaultContract.estimateGas, swapAmount, minSwapAmount)
    ).toNumber()
  }

  const redeemVault = async () => {
    const gasEstimate = await redeemVaultGasEstimate(swapAmount, minSwapAmount)
    const gasLimit = parseInt(gasEstimate * (1 + redeemPercentGasLimitBuffer))

    return {
      result: await _redeemVault(vaultContract, swapAmount, minSwapAmount, {
        gasLimit,
      }),
      swapAmount,
      minSwapAmount,
    }
  }

  const swapFlipper = async () => {
    // need to calculate these again, since Flipper takes all amount inputs in 18 decimal format
    const { swapAmount: swapAmountFlipper } = calculateSwapAmounts(
      amountRaw,
      18
    )

    let flipperResult
    if (swapMode === 'mint') {
      if (selectedCoin === 'dai') {
        flipperResult = await flipper.buyOusdWithDai(swapAmountFlipper)
      } else if (selectedCoin === 'usdt') {
        flipperResult = await flipper.buyOusdWithUsdt(swapAmountFlipper)
      } else if (selectedCoin === 'usdc') {
        flipperResult = await flipper.buyOusdWithUsdc(swapAmountFlipper)
      }
    } else {
      if (selectedCoin === 'dai') {
        flipperResult = await flipper.sellOusdForDai(swapAmountFlipper)
      } else if (selectedCoin === 'usdt') {
        flipperResult = await flipper.sellOusdForUsdt(swapAmountFlipper)
      } else if (selectedCoin === 'usdc') {
        flipperResult = await flipper.sellOusdForUsdc(swapAmountFlipper)
      }
    }

    return {
      result: flipperResult,
      swapAmount,
      minSwapAmount,
    }
  }

  const _swapUniswap = async (callObject, swapAmount, minSwapAmount) => {
    if (selectedCoin !== 'usdt') {
      throw new Error('Uniswap can swap only between ousd & usdt')
    }

    return await callObject.exactInputSingle([
      swapMode === 'mint' ? usdtContract.address : ousdContract.address,
      swapMode === 'mint' ? ousdContract.address : usdtContract.address,
      500, // pre-defined Factory fee for stablecoins
      account, // recipient
      BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
      swapAmount, // amountIn
      minSwapAmount, // amountOutMinimum
      0, // sqrtPriceLimitX96
    ])
  }

  const swapUniswapGasEstimate = async (swapAmount, minSwapAmount) => {
    return (
      await _swapUniswap(uniV3SwapRouter.estimateGas, swapAmount, minSwapAmount)
    ).toNumber()
  }

  const swapUniswap = async () => {
    return {
      result: await _swapUniswap(uniV3SwapRouter, swapAmount, minSwapAmount),
      swapAmount,
      minSwapAmount,
    }
  }

  return {
    allowancesLoaded,
    needsApproval,
    mintVault,
    mintVaultGasEstimate,
    redeemVault,
    redeemVaultGasEstimate,
    swapFlipper,
    swapUniswapGasEstimate,
    swapUniswap,
  }
}

export default useCurrencySwapper
