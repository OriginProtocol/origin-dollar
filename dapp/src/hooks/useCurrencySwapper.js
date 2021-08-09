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

import { calculateMintAmounts } from 'utils/math'

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

  const { contract: coinContract, decimals } = coinInfoList[selectedCoin]
  // plain amount as displayed in UI (not in wei format)
  const amount = parseFloat(amountRaw)

  const { mintAmount, minMintAmount } = calculateMintAmounts(
    amountRaw,
    decimals,
    priceToleranceValue
  )

  const _mintVault = async (
    callObject,
    mintAmount,
    minMintAmount,
    options = {}
  ) => {
    return await callObject.mint(
      coinContract.address,
      mintAmount,
      minMintAmount,
      options
    )
  }

  useEffect(() => {
    if (!amount || !bestSwap || !allowances || Object.keys(allowances) === 0) {
      return
    }

    const nameMaps = {
      vault: 'vault',
      flipper: 'flipper',
      uniswap: 'uniswapV3Router',
    }

    setNeedsApproval(
      (parseFloat(allowances[selectedCoin][nameMaps[bestSwap.name]]) < amount) ?
      bestSwap.name : 
      false
    )
    
  }, [amount, allowances, selectedCoin, bestSwap])

  const mintVaultGasEstimate = async (mintAmount, minMintAmount) => {
    console.log(
      'Calling with values',
      mintAmount.toString(),
      minMintAmount.toString()
    )
    return (
      await _mintVault(vaultContract.estimateGas, mintAmount, minMintAmount)
    ).toNumber()
  }

  const mintVault = async () => {
    const gasEstimate = await mintVaultGasEstimate(mintAmount, minMintAmount)
    const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )

    return {
      result: await _mintVault(vaultContract, mintAmount, minMintAmount, {
        gasLimit,
      }),
      mintAmount,
      minMintAmount,
    }
  }

  const swapFlipper = async () => {
    // need to calculate these again, since Flipper takes all amount inputs in 18 decimal format
    const { mintAmount: mintAmountFlipper } = calculateMintAmounts(
      amountRaw,
      18
    )

    let flipperResult
    if (swapMode === 'mint') {
      if (selectedCoin === 'dai') {
        flipperResult = await flipper.buyOusdWithDai(mintAmountFlipper)
      } else if (selectedCoin === 'usdt') {
        flipperResult = await flipper.buyOusdWithUsdt(mintAmountFlipper)
      } else if (selectedCoin === 'usdc') {
        flipperResult = await flipper.buyOusdWithUsdc(mintAmountFlipper)
      }
    } else {
      if (selectedCoin === 'dai') {
        flipperResult = await flipper.sellOusdForDai(mintAmountFlipper)
      } else if (selectedCoin === 'usdt') {
        flipperResult = await flipper.sellOusdForUsdt(mintAmountFlipper)
      } else if (selectedCoin === 'usdc') {
        flipperResult = await flipper.sellOusdForUsdc(mintAmountFlipper)
      }
    }

    return {
      result: flipperResult,
      mintAmount,
      minMintAmount,
    }
  }

  const _swapUniswap = async (callObject, mintAmount, minMintAmount) => {
    if (selectedCoin !== 'usdt') {
      throw new Error('Uniswap can swap only between ousd & usdt')
    }

    return await callObject.exactInputSingle([
      swapMode === 'mint' ? usdtContract.address : ousdContract.address,
      swapMode === 'mint' ? ousdContract.address : usdtContract.address,
      500, // pre-defined Factory fee for stablecoins
      account, // recipient
      BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
      mintAmount, // amountIn
      minMintAmount, // amountOutMinimum
      //0, // amountOutMinimum
      0, // sqrtPriceLimitX96
    ])
  }

  const swapUniswapGasEstimate = async (mintAmount, minMintAmount) => {
    return (
      await _swapUniswap(uniV3SwapRouter.estimateGas, mintAmount, minMintAmount)
    ).toNumber()
  }

  const swapUniswap = async () => {
    return {
      result: await _swapUniswap(uniV3SwapRouter, mintAmount, minMintAmount),
      mintAmount,
      minMintAmount,
    }
  }

  return {
    allowancesLoaded,
    needsApproval,
    mintVault,
    mintVaultGasEstimate,
    swapFlipper,
    swapUniswapGasEstimate,
    swapUniswap,
  }
}

export default useCurrencySwapper
