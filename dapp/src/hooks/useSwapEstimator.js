import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
} from 'utils/constants'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import ContractStore from 'stores/ContractStore'
import { calculateMintAmounts } from 'utils/math'

/* Swap estimator listens for input changes of the currency and amount users is attempting
 * to swap and with some delay (to not cause too many calls) kicks off swap estimations.
 */
const useSwapEstimator = (
  swapMode,
  amountRaw,
  selectedCoin,
  priceToleranceValue
) => {
  const contracts = useStoreState(ContractStore, (s) => s.contracts)
  const coinInfoList = useStoreState(ContractStore, (s) => s.coinInfoList)
  const { contract: selectedCoinContract, selectedCoinDecimals } = coinInfoList[
    selectedCoin
  ]
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const [estimationCallback, setEstimationCallback] = useState(null)
  const { mintVaultGasEstimate, swapUniswapGasEstimate } = useCurrencySwapper(
    swapMode,
    amountRaw,
    selectedCoin,
    priceToleranceValue
  )
  const { mintAmount, minMintAmount } = calculateMintAmounts(
    amountRaw,
    decimals,
    priceToleranceValue
  )

  useEffect(() => {
    console.log('ESTIMATION CALLBACK')
    if (estimationCallback) {
      clearTimeout(estimationCallback)
    }

    /* Timeout the execution so it doesn't happen on each key stroke rather aiming
     * to when user has already stopped typing
     */
    setEstimationCallback(
      setTimeout(async () => {
        await runEstimations(mode, selectedCoin, amount)
      }, 300)
    )
  }, [mode, selectedCoin, amount])

  const runEstimations = async (mode, selectedCoin, amount) => {
    const coinAmountNumber = parseFloat(amount)
    if (!(coinAmountNumber > 0) || Number.isNaN(coinAmountNumber)) {
      ContractStore.update((s) => {
        s.swapEstimations = null
      })
      return
    }

    ContractStore.update((s) => {
      s.swapEstimations = 'loading'
    })

    let vaultResult, flipperResult, uniswapResult
    if (swapMode === 'mint') {
      ;[vaultResult, flipperResult, uniswapResult] = await Promise.all([
        estimateMintSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswap(),
      ])
    } else {
      ;[vaultResult, flipperResult, uniswapResult] = await Promise.all([
        estimateRedeemSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswap(),
      ])
    }

    ContractStore.update((s) => {
      s.swapEstimations = {
        vault: vaultResult,
        flipper: flipperResult,
        uniswap: uniswapResult,
      }
    })
  }

  /* Gives information on suitability of flipper for this swap
   */
  const estimateSwapSuitabilityFlipper = async () => {
    const amount = parseFloat(amountRaw)
    if (amount > 25000) {
      return {
        canDoSwap: false,
        reason: 'amount_too_high',
      }
    }

    const coinToReceiveBn = ethers.utils.parseUnits(
      amount.toString(),
      selectedCoinDecimals
    )
    const contractCoinBalance = await selectedCoinContract.balanceOf(
      contracts.flipper.address
    )

    if (contractCoinBalance.lt(coinToReceiveBn)) {
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
   */
  const estimateSwapSuitabilityUniswap = async () => {
    // currently we support only direct swap. No reason why not to support multiple swaps in the future.
    if (
      !['ousd', 'usdt'].includes(coinToSwap) ||
      ['ousd', 'usdt'].includes(coinToReceive)
    ) {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    /* Check if Uniswap router has allowance to spend coin. If not we can not run gas estimation and need
     * to guess the gas usage.
     *
     * We don't check if positive amount is large enough: since we always approve max_int allowance.
     */
    if (parseFloat(allowances[coinToSwap].uniswapV3Router) === 0) {
      return {
        canDoSwap: true,
        /* This estimate is over the maximum one appearing on mainnet: https://etherscan.io/tx/0x6b1163b012570819e2951fa95a8287ce16be96b8bf18baefb6e738d448188ed5
         * Swap gas costs are usually between 142k - 162k
         *
         * Other transactions here: https://etherscan.io/tokentxns?a=0x129360c964e2e13910d603043f6287e5e9383374&p=6
         */

        gasUsed: 165000,
        // TODO: get this right
        amountReceived: amountRaw,
      }
    }

    const gasEstimate = (
      await uniV3SwapRouter.estimateGas.exactInputSingle([
        coinToSwap === 'ousd' ? contracts.ousd : contracts.usdt,
        coinToReceive === 'ousd' ? contracts.ousd : contracts.usdt,
        500, // pre-defined Factory fee for stablecoins
        account, // recipient
        BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
        mintAmount, // amountIn
        minMintAmount, // amountOutMinimum
        0, // sqrtPriceLimitX96
      ])
    ).toNumber()

    return {
      canDoSwap: true,
      gasUsed: gasEstimate,
      // TODO: get this right
      amountReceived: amountRaw,
    }
  }

  /* Gives information on suitability of vault mint
   */
  const estimateMintSuitabilityVault = async () => {
    const amount = parseFloat(amountRaw)
    const gasEstimate = (
      await contracts.vault.estimateGas.mint(
        selectedCoinContract.address,
        amount,
        minMintAmount
      )
    ).toNumber()

    const gasLimit = parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )

    // 18 decimals denominated BN exchange rate value
    const oracleCoinPrice = await contracts.vault.priceUSDMint(
      selectedCoinContract.address
    )

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
   */
  const estimateRedeemSuitabilityVault = async () => {
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
