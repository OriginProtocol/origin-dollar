import React, { useEffect, useState } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useStoreState } from 'pullstate'
import { get, minBy } from 'lodash'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
} from 'utils/constants'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import ContractStore from 'stores/ContractStore'
import { calculateSwapAmounts, formatCurrency } from 'utils/math'

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
  const balances = useStoreState(AccountStore, (s) => s.balances)

  const {
    contract: coinToSwapContract,
    decimals: coinToSwapDecimals,
  } = coinInfoList[swapMode === 'mint' ? selectedCoin : 'ousd']

  let coinToReceiveContract, coinToReceiveDecimals

  // do not enter conditional body when redeeming a mix
  if (!(swapMode === 'redeem' && selectedCoin === 'mix')) {
    ;({
      contract: coinToReceiveContract,
      decimals: coinToReceiveDecimals,
    } = coinInfoList[swapMode === 'redeem' ? selectedCoin : 'ousd'])
  }

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.ousd &&
    allowances.usdt &&
    allowances.usdc &&
    allowances.dai

  const account = useStoreState(AccountStore, (s) => s.account)
  const [gasPrice, setGasPrice] = useState(false)
  const [ethPrice, setEthPrice] = useState(false)
  const [estimationCallback, setEstimationCallback] = useState(null)
  const {
    mintVaultGasEstimate,
    swapUniswapGasEstimate,
    quoteUniswap,
    redeemVaultGasEstimate,
  } = useCurrencySwapper(swapMode, amountRaw, selectedCoin, priceToleranceValue)

  const { swapAmount, minSwapAmount } = calculateSwapAmounts(
    amountRaw,
    coinToSwapDecimals,
    priceToleranceValue
  )

  useEffect(() => {
    if (estimationCallback) {
      clearTimeout(estimationCallback)
    }

    const coinAmountNumber = parseFloat(amountRaw)
    if (!(coinAmountNumber > 0) || Number.isNaN(coinAmountNumber)) {
      ContractStore.update((s) => {
        s.swapEstimations = null
      })
      return
    }

    if (!allowancesLoaded) {
      return
    }

    /* Timeout the execution so it doesn't happen on each key stroke rather aiming
     * to when user has already stopped typing
     */
    setEstimationCallback(
      setTimeout(async () => {
        await runEstimations(swapMode, selectedCoin, amountRaw)
      }, 700)
    )
  }, [swapMode, selectedCoin, amountRaw, allowancesLoaded])

  const runEstimations = async (mode, selectedCoin, amount) => {
    console.log('RUnning estimations')
    ContractStore.update((s) => {
      s.swapEstimations = 'loading'
    })

    let vaultResult, flipperResult, uniswapResult, gasValues
    if (swapMode === 'mint') {
      ;[
        vaultResult,
        flipperResult,
        uniswapResult,
        gasValues,
      ] = await Promise.all([
        estimateMintSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswap(),
        fetchGasPrice(),
      ])
    } else {
      ;[
        vaultResult,
        flipperResult,
        uniswapResult,
        gasValues,
      ] = await Promise.all([
        estimateRedeemSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswap(),
        fetchGasPrice(),
      ])
    }

    let estimations = {
      vault: vaultResult,
      flipper: flipperResult,
      uniswap: uniswapResult,
    }

    estimations = enrichAndFindTheBest(
      estimations,
      gasValues.gasPrice,
      gasValues.ethPrice
    )

    ContractStore.update((s) => {
      s.swapEstimations = estimations
    })
  }

  const enrichAndFindTheBest = (estimations, gasPrice, ethPrice) => {
    console.log('ESTIMATIONS', estimations)
    Object.keys(estimations).map((estKey) => {
      const value = estimations[estKey]
      // assign names to values, for easier manipulation
      value.name = estKey
      value.isBest = false

      estimations[estKey] = value
    })

    const canDoSwaps = Object.values(estimations).filter(
      (estimation) => estimation.canDoSwap
    )

    canDoSwaps.map((estimation) => {
      const gasUsdCost = getGasUsdCost(estimation.gasUsed, gasPrice, ethPrice)
      const gasUsdCostNumber = parseFloat(gasUsdCost)
      const amountNumber = parseFloat(estimation.amountReceived)

      estimation.gasEstimate = gasUsdCost
      estimation.effectivePrice =
        (amountNumber + gasUsdCostNumber) / amountNumber
    })

    const best = minBy(canDoSwaps, (estimation) => estimation.effectivePrice)

    if (best) {
      best.isBest = true
      canDoSwaps.map((estimation) => {
        if (estimation === best) {
          return
        }

        estimation.diff = estimation.effectivePrice - best.effectivePrice
      })
    }

    return estimations
  }

  const getGasUsdCost = (gasLimit, gasPrice, ethPrice) => {
    if (!gasPrice || !ethPrice) {
      return null
    }

    const priceInUsd = ethers.utils.formatUnits(
      gasPrice.mul(ethPrice).mul(BigNumber.from(gasLimit)).toString(),
      18
    )

    return priceInUsd
  }

  const userHasEnoughStablecoin = (coin, swapAmount) => {
    return parseFloat(balances[coin]) > swapAmount
  }

  /* Gives information on suitability of flipper for this swap
   */
  const estimateSwapSuitabilityFlipper = async () => {
    const amount = parseFloat(amountRaw)
    if (amount > 25000) {
      return {
        canDoSwap: false,
        error: 'amount_too_high',
      }
    }

    if (swapMode === 'redeem' && selectedCoin === 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    const coinToReceiveBn = ethers.utils.parseUnits(
      amount.toString(),
      coinToReceiveDecimals
    )

    const contractCoinBalance = await coinToReceiveContract.balanceOf(
      contracts.flipper.address
    )

    if (contractCoinBalance.lt(coinToReceiveBn)) {
      return {
        canDoSwap: false,
        error: 'not_enough_funds_contract',
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
    if (!['ousd', 'usdt'].includes(selectedCoin)) {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    if (swapMode === 'redeem' && selectedCoin === 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    try {
      const priceQuote = await quoteUniswap(swapAmount)
      const priceQuoteBn = BigNumber.from(priceQuote)
      const amountReceived = ethers.utils.formatUnits(priceQuoteBn, 18)

      if (
        parseFloat(allowances[selectedCoin].uniswapV3Router) === 0 ||
        !userHasEnoughStablecoin(
          swapMode === 'redeem' ? 'ousd' : selectedCoin,
          parseFloat(amountRaw)
        )
      ) {
        return {
          canDoSwap: true,
          /* This estimate is over the maximum one appearing on mainnet: https://etherscan.io/tx/0x6b1163b012570819e2951fa95a8287ce16be96b8bf18baefb6e738d448188ed5
           * Swap gas costs are usually between 142k - 162k
           *
           * Other transactions here: https://etherscan.io/tokentxns?a=0x129360c964e2e13910d603043f6287e5e9383374&p=6
           */

          gasUsed: 165000,
          amountReceived,
        }
      }

      /* Check if Uniswap router has allowance to spend coin. If not we can not run gas estimation and need
       * to guess the gas usage.
       *
       * We don't check if positive amount is large enough: since we always approve max_int allowance.
       */
      if (
        parseFloat(allowances[selectedCoin].uniswapV3Router) === 0 ||
        !userHasEnoughStablecoin(
          swapMode === 'redeem' ? 'ousd' : selectedCoin,
          parseFloat(amountRaw)
        )
      ) {
        return {
          canDoSwap: true,
          /* This estimate is over the maximum one appearing on mainnet: https://etherscan.io/tx/0x6b1163b012570819e2951fa95a8287ce16be96b8bf18baefb6e738d448188ed5
           * Swap gas costs are usually between 142k - 162k
           *
           * Other transactions here: https://etherscan.io/tokentxns?a=0x129360c964e2e13910d603043f6287e5e9383374&p=6
           */

          gasUsed: 165000,
          amountReceived,
        }
      }

      const gasEstimate = await swapUniswapGasEstimate(
        swapAmount,
        minSwapAmount
      )

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating uniswap swap suitability: ${e.message}`
      )
      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  /* Gives information on suitability of vault mint
   */
  const estimateMintSuitabilityVault = async () => {
    const amount = parseFloat(amountRaw)

    // Check if Vault has allowance to spend coin.
    if (
      parseFloat(allowances[selectedCoin].vault) === 0 ||
      !userHasEnoughStablecoin(selectedCoin, amount)
    ) {
      return {
        canDoSwap: true,
        // TODO do get this value right in regard to rebase / allocate thresholds
        gasUsed: 220000,
        // TODO: get this right
        amountReceived: amountRaw,
      }
    }

    try {
      const gasEstimate = await mintVaultGasEstimate(swapAmount, minSwapAmount)

      // 18 decimals denominated BN exchange rate value
      const oracleCoinPrice = await contracts.vault.priceUSDMint(
        coinToSwapContract.address
      )

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        // TODO: should this be rather done with BigNumbers instead?
        amountReceived:
          amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18)),
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating vault swap suitability: ${e.message}`
      )
      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  /* Gives information on suitability of vault redeem
   */
  const estimateRedeemSuitabilityVault = async () => {
    if (selectedCoin !== 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    const amount = parseFloat(amountRaw)
    // Check if Vault has allowance to spend coin.
    if (
      parseFloat(allowances.ousd.vault) === 0 ||
      !userHasEnoughStablecoin('ousd', amount)
    ) {
      return {
        canDoSwap: true,
        gasUsed: 1500000,
        amountReceived: amountRaw,
      }
    }

    let gasEstimate
    try {
      await loadRedeemFee()
      gasEstimate = await redeemVaultGasEstimate(swapAmount, minSwapAmount)

      const exitFee = amount * redeemFee
      const coinSplits = await _calculateSplits(amount)
      const splitsSum = coinSplits
        .map((coin) => parseFloat(coin.amount))
        .reduce((a, b) => a + b, 0)

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        // TODO: should this be rather done with BigNumbers instead?
        amountReceived: splitsSum - exitFee,
        coinSplits,
      }
    } catch (e) {
      console.error(`Can not estimate contract call gas used: ${e.message}`)
      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  let redeemFee
  const loadRedeemFee = async () => {
    if (!redeemFee) {
      const redeemFeeBn = await contracts.vault.redeemFeeBps()
      redeemFee = parseFloat(ethers.utils.formatUnits(redeemFeeBn, 4))
    }
  }

  // Fetches current gas & ethereum prices
  const fetchGasPrice = async () => {
    try {
      const gasPriceRequest = await fetch(
        'https://www.gasnow.org/api/v3/gas/price?utm_source=OUSD.com'
      )
      const ethPriceRequest = await fetch(
        'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD'
      )

      const gasPrice = BigNumber.from(
        get(await gasPriceRequest.json(), 'data.standard')
      )
      // floor so we can convert to BN without a problem
      const ethPrice = BigNumber.from(
        Math.floor(get(await ethPriceRequest.json(), 'USD'))
      )
      setGasPrice(gasPrice)
      setEthPrice(ethPrice)

      return {
        gasPrice,
        ethPrice,
      }
    } catch (e) {
      console.error(`Can not fetch gas / eth prices: ${e.message}`)
    }

    return {
      gasPrice: 0,
      ethPrice: 0,
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
              coinInfoList[coin].decimals
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
