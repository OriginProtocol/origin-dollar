import React, { useEffect, useState } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useStoreState } from 'pullstate'
import { get, minBy } from 'lodash'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
  approveCoinGasLimits,
} from 'utils/constants'
import { usePrevious } from 'utils/hooks'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import ContractStore from 'stores/ContractStore'
import { calculateSwapAmounts, formatCurrency } from 'utils/math'
import fetchWithTimeout from 'utils/fetchWithTimeout'
import { find } from 'lodash'

/* Swap estimator listens for input changes of the currency and amount users is attempting
 * to swap and with some delay (to not cause too many calls) kicks off swap estimations.
 */
const useSwapEstimator = ({
  swapMode,
  inputAmountRaw,
  selectedCoin,
  priceToleranceValue,
}) => {
  const contracts = useStoreState(ContractStore, (s) => s.contracts)
  const chainId = useStoreState(ContractStore, (s) => s.chainId)
  const coinInfoList = useStoreState(ContractStore, (s) => s.coinInfoList)
  const vaultAllocateThreshold = useStoreState(
    ContractStore,
    (s) => s.vaultAllocateThreshold
  )
  const vaultRebaseThreshold = useStoreState(
    ContractStore,
    (s) => s.vaultRebaseThreshold
  )
  const gasPrice = useStoreState(ContractStore, (s) => s.gasPrice)
  const previousGasPrice = usePrevious(gasPrice)
  const isGasPriceUserOverriden = useStoreState(
    ContractStore,
    (s) => s.isGasPriceUserOverriden
  )

  const balances = useStoreState(AccountStore, (s) => s.balances)

  const { contract: coinToSwapContract, decimals: coinToSwapDecimals } =
    coinInfoList[swapMode === 'mint' ? selectedCoin : 'ousd']
  const coinToSwap = swapMode === 'redeem' ? 'ousd' : selectedCoin

  const [selectedCoinPrev, setSelectedCoinPrev] = useState()

  let coinToReceiveContract, coinToReceiveDecimals

  // do not enter conditional body when redeeming a mix
  if (!(swapMode === 'redeem' && selectedCoin === 'mix')) {
    ;({ contract: coinToReceiveContract, decimals: coinToReceiveDecimals } =
      coinInfoList[swapMode === 'redeem' ? selectedCoin : 'ousd'])
  }

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.ousd !== undefined &&
    allowances.usdt !== undefined &&
    allowances.usdc !== undefined &&
    allowances.dai !== undefined

  const account = useStoreState(AccountStore, (s) => s.account)
  const [ethPrice, setEthPrice] = useState(false)
  const [estimationCallback, setEstimationCallback] = useState(null)
  const {
    mintVaultGasEstimate,
    swapUniswapGasEstimate,
    swapCurveGasEstimate,
    swapUniswapV2GasEstimate,
    swapUniswapV2,
    swapCurve,
    quoteUniswap,
    quoteUniswapV2,
    quoteSushiSwap,
    swapSushiswapGasEstimate,
    quoteCurve,
    redeemVaultGasEstimate,
  } = useCurrencySwapper({
    swapMode,
    inputAmountRaw,
    selectedCoin,
    priceToleranceValue,
  })

  const { swapAmount, minSwapAmount } = calculateSwapAmounts(
    inputAmountRaw,
    coinToSwapDecimals,
    priceToleranceValue
  )

  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const walletConnected = useStoreState(ContractStore, (s) => s.walletConnected)

  useEffect(() => {
    const swapsLoaded = swapEstimations && typeof swapEstimations === 'object'
    const userSelectionExists =
      swapsLoaded &&
      find(
        Object.values(swapEstimations),
        (estimation) => estimation.userSelected
      )

    const selectedSwap =
      swapsLoaded &&
      find(Object.values(swapEstimations), (estimation) =>
        userSelectionExists ? estimation.userSelected : estimation.isBest
      )

    ContractStore.update((s) => {
      s.selectedSwap = selectedSwap
    })
  }, [swapEstimations])

  // just so initial gas price is populated in the settings dropdown
  useEffect(() => {
    fetchGasPrice()
  }, [])

  useEffect(() => {
    /*
     * Weird race condition would happen where estimations were ran with the utils/contracts setting up
     * the contracts with alchemy provider instead of Metamask one. When estimations are ran with that
     * setup, half of the estimations fail with an error.
     */
    if (!walletConnected) {
      return
    }

    /*
     * When function is triggered because of a non user change in gas price, ignore the trigger.
     */
    if (!isGasPriceUserOverriden && previousGasPrice !== gasPrice) {
      return
    }

    if (!allowancesLoaded) {
      return
    }

    if (estimationCallback) {
      clearTimeout(estimationCallback)
    }

    const coinAmountNumber = parseFloat(inputAmountRaw)
    if (!(coinAmountNumber > 0) || Number.isNaN(coinAmountNumber)) {
      ContractStore.update((s) => {
        s.swapEstimations = null
      })
      return
    }

    /* Timeout the execution so it doesn't happen on each key stroke rather aiming
     * to when user has already stopped typing
     */
    const delay = selectedCoin !== selectedCoinPrev ? 0 : 700
    // reset swap estimations here for better UI experience
    if (delay === 0) {
      ContractStore.update((s) => {
        s.swapEstimations = 'loading'
      })
    }
    setEstimationCallback(
      setTimeout(async () => {
        await runEstimations(swapMode, selectedCoin, inputAmountRaw)
      }, delay)
    )
    setSelectedCoinPrev(selectedCoin)
  }, [
    swapMode,
    selectedCoin,
    inputAmountRaw,
    allowancesLoaded,
    walletConnected,
    isGasPriceUserOverriden,
    gasPrice,
  ])

  const gasLimitForApprovingCoin = (coin) => {
    return approveCoinGasLimits[coin]
  }

  const runEstimations = async (mode, selectedCoin, amount) => {
    ContractStore.update((s) => {
      s.swapEstimations = 'loading'
    })
    let usedGasPrice = gasPrice

    let vaultResult,
      flipperResult,
      uniswapResult,
      uniswapV2Result,
      sushiswapResult,
      curveResult,
      ethPrice
    if (swapMode === 'mint') {
      ;[
        vaultResult,
        flipperResult,
        uniswapResult,
        uniswapV2Result,
        sushiswapResult,
        curveResult,
        ethPrice,
      ] = await Promise.all([
        estimateMintSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswapV3(),
        estimateSwapSuitabilityUniswapV2(),
        estimateSwapSuitabilitySushiSwap(),
        estimateSwapSuitabilityCurve(),
        fetchEthPrice(),
      ])
    } else {
      ;[
        vaultResult,
        flipperResult,
        uniswapResult,
        uniswapV2Result,
        sushiswapResult,
        curveResult,
        ethPrice,
      ] = await Promise.all([
        estimateRedeemSuitabilityVault(),
        estimateSwapSuitabilityFlipper(),
        estimateSwapSuitabilityUniswapV3(),
        estimateSwapSuitabilityUniswapV2(),
        estimateSwapSuitabilitySushiSwap(),
        estimateSwapSuitabilityCurve(),
        fetchEthPrice(),
      ])
    }

    if (!isGasPriceUserOverriden) {
      usedGasPrice = await fetchGasPrice()
    }

    let estimations = {
      vault: vaultResult,
      flipper: flipperResult,
      uniswap: uniswapResult,
      curve: curveResult,
      uniswapV2: uniswapV2Result,
      sushiswap: sushiswapResult,
    }

    estimations = enrichAndFindTheBest(
      estimations,
      usedGasPrice,
      ethPrice,
      amount
    )

    ContractStore.update((s) => {
      s.swapEstimations = estimations
    })
  }

  const enrichAndFindTheBest = (
    estimations,
    gasPrice,
    ethPrice,
    inputAmountRaw
  ) => {
    Object.keys(estimations).map((estKey) => {
      const value = estimations[estKey]
      // assign names to values, for easier manipulation
      value.name = estKey
      value.isBest = false
      value.userSelected = false

      estimations[estKey] = value
    })

    const canDoSwaps = Object.values(estimations).filter(
      (estimation) => estimation.canDoSwap
    )

    const inputAmount = parseFloat(inputAmountRaw)
    canDoSwaps.map((estimation) => {
      const gasUsdCost = getGasUsdCost(estimation.gasUsed, gasPrice, ethPrice)
      const gasUsdCostNumber = parseFloat(gasUsdCost)
      const amountReceivedNumber = parseFloat(estimation.amountReceived)

      estimation.gasEstimate = gasUsdCost
      if (estimation.approveAllowanceNeeded) {
        estimation.gasEstimateSwap = getGasUsdCost(
          estimation.swapGasUsage,
          gasPrice,
          ethPrice
        )
        estimation.gasEstimateApprove = getGasUsdCost(
          estimation.approveGasUsage,
          gasPrice,
          ethPrice
        )
      }
      estimation.effectivePrice =
        (inputAmount + gasUsdCostNumber) / amountReceivedNumber
    })

    const best = minBy(canDoSwaps, (estimation) => estimation.effectivePrice)

    if (best) {
      best.isBest = true
      canDoSwaps.map((estimation) => {
        if (estimation === best) {
          return
        }

        estimation.diff = estimation.effectivePrice - best.effectivePrice
        estimation.diffPercentage =
          ((best.effectivePrice - estimation.effectivePrice) /
            best.effectivePrice) *
          100
      })
    }

    return estimations
  }

  const getGasUsdCost = (gasLimit, gasPrice, ethPrice) => {
    if (!gasPrice || !ethPrice) {
      return null
    }

    const flooredEth = Math.floor(ethPrice)
    const priceInUsd = ethers.utils.formatUnits(
      gasPrice
        .mul(BigNumber.from(flooredEth))
        .mul(BigNumber.from(gasLimit))
        .toString(),
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
    const amount = parseFloat(inputAmountRaw)
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

    const approveAllowanceNeeded =
      parseFloat(allowances[coinToSwap].flipper) === 0
    const swapGasUsage = 90000
    const approveGasUsage = approveAllowanceNeeded
      ? gasLimitForApprovingCoin(coinToSwap)
      : 0
    return {
      // gasLimitForApprovingCoin
      canDoSwap: true,
      gasUsed: swapGasUsage + approveGasUsage,
      swapGasUsage,
      approveGasUsage,
      approveAllowanceNeeded,
      amountReceived: amount,
    }
  }

  /* Gives information on suitability of Curve for this swap
   */
  const estimateSwapSuitabilityCurve = async () => {
    const isRedeem = swapMode === 'redeem'
    if (isRedeem && selectedCoin === 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    try {
      const priceQuoteBn = await quoteCurve(swapAmount)
      const amountReceived = ethers.utils.formatUnits(
        priceQuoteBn,
        // 18 because ousd has 18 decimals
        isRedeem ? coinToReceiveDecimals : 18
      )

      const approveAllowanceNeeded =
        parseFloat(allowances[coinToSwap].curve) === 0

      /* Check if Curve router has allowance to spend coin. If not we can not run gas estimation and need
       * to guess the gas usage.
       *
       * We don't check if positive amount is large enough: since we always approve max_int allowance.
       */
      if (
        approveAllowanceNeeded ||
        !userHasEnoughStablecoin(coinToSwap, parseFloat(inputAmountRaw))
      ) {
        const swapGasUsage = 350000
        const approveGasUsage = approveAllowanceNeeded
          ? gasLimitForApprovingCoin(coinToSwap)
          : 0
        return {
          canDoSwap: true,
          /* This estimate is from the few ones observed on the mainnet:
           * https://etherscan.io/tx/0x3ff7178d8be668649928d86863c78cd249224211efe67f23623017812e7918bb
           * https://etherscan.io/tx/0xbf033ffbaf01b808953ca1904d3b0110b50337d60d89c96cd06f3f9a6972d3ca
           * https://etherscan.io/tx/0x77d98d0307b53e81f50b39132e038a1c6ef87a599a381675ce44038515a04738
           * https://etherscan.io/tx/0xbce1a2f1e76d4b4f900b3952f34f5f53f8be4a65ccff348661d19b9a3827aa04
           *
           */
          gasUsed: swapGasUsage + approveGasUsage,
          swapGasUsage,
          approveGasUsage,
          approveAllowanceNeeded,
          amountReceived,
        }
      }

      const {
        swapAmount: swapAmountQuoted,
        minSwapAmount: minSwapAmountQuoted,
      } = calculateSwapAmounts(
        amountReceived,
        coinToReceiveDecimals,
        priceToleranceValue
      )

      const gasEstimate = await swapCurveGasEstimate(
        swapAmount,
        minSwapAmountQuoted
      )

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating curve swap suitability: ${e.message}`
      )
      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  const estimateSwapSuitabilityUniswapV2 = async () => {
    return _estimateSwapSuitabilityUniswapV2Variant(false)
  }

  const estimateSwapSuitabilitySushiSwap = async () => {
    return _estimateSwapSuitabilityUniswapV2Variant(true)
  }

  // Gives information on suitability of uniswapV2 / SushiSwap for this swap
  const _estimateSwapSuitabilityUniswapV2Variant = async (
    isSushiSwap = false
  ) => {
    const isRedeem = swapMode === 'redeem'
    if (isRedeem && selectedCoin === 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    try {
      const priceQuoteValues = isSushiSwap
        ? await quoteSushiSwap(swapAmount)
        : await quoteUniswapV2(swapAmount)
      const priceQuoteBn = priceQuoteValues[priceQuoteValues.length - 1]

      // 18 because ousd has 18 decimals
      const amountReceived = ethers.utils.formatUnits(
        priceQuoteBn,
        isRedeem ? coinToReceiveDecimals : 18
      )

      /* Check if Uniswap router has allowance to spend coin. If not we can not run gas estimation and need
       * to guess the gas usage.
       *
       * We don't check if positive amount is large enough: since we always approve max_int allowance.
       */
      const requiredAllowance =
        allowances[coinToSwap][isSushiSwap ? 'sushiRouter' : 'uniswapV2Router']

      if (requiredAllowance === undefined) {
        throw new Error('Can not find correct allowance for coin')
      }

      const approveAllowanceNeeded = parseFloat(requiredAllowance) === 0

      if (
        approveAllowanceNeeded ||
        !userHasEnoughStablecoin(coinToSwap, parseFloat(inputAmountRaw))
      ) {
        const swapGasUsage = selectedCoin === 'usdt' ? 175000 : 230000
        const approveGasUsage = approveAllowanceNeeded
          ? gasLimitForApprovingCoin(coinToSwap)
          : 0
        return {
          canDoSwap: true,
          /* Some example Uniswap transactions. When 2 swaps are done:
           * - https://etherscan.io/tx/0x436ef157435c93241257fb0b347db7cc1b2c4f73d749c7e5c1181393f3d0aa26
           * - https://etherscan.io/tx/0x504799fecb64a0452f5635245ca313aa5612132dc6fe66c441b61fd98a0e0766
           * - https://etherscan.io/tx/0x2e3429fb9f04819a55f85cfdbbaf78dfbb049bff85be84a324650d77ff98dfc3
           *
           * And Uniswap when 1 swap:
           * - https://etherscan.io/tx/0x6ceca6c6c2a829928bbf9cf97a018b431def8e475577fcc7cc97ed6bd35f9f7b
           * - https://etherscan.io/tx/0x02c1fffb94b06d54e0c6d47da460cb6e5e736e43f928b7e9b2dcd964b1390188
           * - https://etherscan.io/tx/0xe5a35025ec3fe71ece49a4311319bdc16302b7cc16b3e7a95f0d8e45baa922c7
           *
           * Some example Sushiswap transactions. When 2 swaps are done:
           * - https://etherscan.io/tx/0x8e66d8d682b8028fd44c916d4318fee7e69704e9f8e386dd7debbfe3157375c5
           * - https://etherscan.io/tx/0xbb837c5f001a0d71c75db49ddc22bd75b7800e426252ef1f1135e8e543769bea
           * - https://etherscan.io/tx/0xe00ab2125b55fd398b00e361e2fd22f6fc9225e609fb2bb2b712586523c89824
           * - https://etherscan.io/tx/0x5c26312ac2bab17aa8895592faa8dc8607f15912de953546136391ee2e955e92
           *
           * And Sushiswap when 1 swap:
           * - https://etherscan.io/tx/0xa8a0c5d2433bcb6ddbfdfb1db7c55c674714690e353f305e4f3c72878ab6a3a7
           * - https://etherscan.io/tx/0x8d2a273d0451ab48c554f8a97d333f7f62b40804946cbd546dc57e2c009514f0
           *
           * Both contracts have very similar gas usage (since they share a lot of the code base)
           */
          gasUsed: swapGasUsage + approveGasUsage,
          swapGasUsage,
          approveGasUsage,
          approveAllowanceNeeded,
          amountReceived,
        }
      }

      const {
        swapAmount: swapAmountQuoted,
        minSwapAmount: minSwapAmountQuoted,
      } = calculateSwapAmounts(
        amountReceived,
        coinToReceiveDecimals,
        priceToleranceValue
      )

      let gasEstimate

      if (isSushiSwap) {
        gasEstimate = await swapSushiswapGasEstimate(
          swapAmount,
          minSwapAmountQuoted
        )
      } else {
        gasEstimate = await swapUniswapV2GasEstimate(
          swapAmount,
          minSwapAmountQuoted
        )
      }

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating ${
          isSushiSwap ? 'sushiSwap' : 'uniswap v2'
        } swap suitability: ${e.message}`
      )

      if (
        (e.data &&
          e.data.message &&
          e.data.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) ||
        e.message.includes('INSUFFICIENT_OUTPUT_AMOUNT')
      ) {
        return {
          canDoSwap: false,
          error: 'slippage_too_high',
        }
      }

      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  /* Gives information on suitability of uniswap for this swap
   */
  const estimateSwapSuitabilityUniswapV3 = async () => {
    const isRedeem = swapMode === 'redeem'
    if (isRedeem && selectedCoin === 'mix') {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    try {
      const priceQuote = await quoteUniswap(swapAmount)
      const priceQuoteBn = BigNumber.from(priceQuote)
      // 18 because ousd has 18 decimals
      const amountReceived = ethers.utils.formatUnits(
        priceQuoteBn,
        isRedeem ? coinToReceiveDecimals : 18
      )

      /* Check if Uniswap router has allowance to spend coin. If not we can not run gas estimation and need
       * to guess the gas usage.
       *
       * We don't check if positive amount is large enough: since we always approve max_int allowance.
       */
      if (
        parseFloat(allowances[coinToSwap].uniswapV3Router) === 0 ||
        !userHasEnoughStablecoin(coinToSwap, parseFloat(inputAmountRaw))
      ) {
        const approveAllowanceNeeded =
          parseFloat(allowances[coinToSwap].uniswapV3Router) === 0
        const approveGasUsage = approveAllowanceNeeded
          ? gasLimitForApprovingCoin(coinToSwap)
          : 0
        const swapGasUsage = 165000
        return {
          canDoSwap: true,
          /* This estimate is over the maximum one appearing on mainnet: https://etherscan.io/tx/0x6b1163b012570819e2951fa95a8287ce16be96b8bf18baefb6e738d448188ed5
           * Swap gas costs are usually between 142k - 162k
           *
           * Other transactions here: https://etherscan.io/tokentxns?a=0x129360c964e2e13910d603043f6287e5e9383374&p=6
           */
          // TODO: if usdc / dai are selected it will cost more gas
          gasUsed: swapGasUsage + approveGasUsage,
          approveAllowanceNeeded,
          swapGasUsage,
          approveGasUsage,
          amountReceived,
        }
      }

      const {
        swapAmount: swapAmountQuoted,
        minSwapAmount: minSwapAmountQuoted,
      } = calculateSwapAmounts(
        amountReceived,
        coinToReceiveDecimals,
        priceToleranceValue
      )

      const gasEstimate = await swapUniswapGasEstimate(
        swapAmount,
        minSwapAmountQuoted
      )

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating uniswap v3 swap suitability: ${e.message}`
      )

      // local node and mainnet return errors in different formats, this handles both cases
      if (
        (e.data &&
          e.data.message &&
          e.data.message.includes('Too little received')) ||
        e.message.includes('Too little received')
      ) {
        return {
          canDoSwap: false,
          error: 'slippage_too_high',
        }
      }

      return {
        canDoSwap: false,
        error: 'unexpected_error',
      }
    }
  }

  /* Gives information on suitability of vault mint
   */
  const estimateMintSuitabilityVault = async () => {
    const amount = parseFloat(inputAmountRaw)

    try {
      // 18 decimals denominated BN exchange rate value
      const oracleCoinPrice = await contracts.vault.priceUSDMint(
        coinToSwapContract.address
      )
      const amountReceived =
        amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))

      const approveAllowanceNeeded =
        parseFloat(allowances[coinToSwap].vault) === 0
      // Check if Vault has allowance to spend coin.
      if (
        approveAllowanceNeeded ||
        !userHasEnoughStablecoin(selectedCoin, amount)
      ) {
        const rebaseTreshold = parseFloat(
          ethers.utils.formatUnits(vaultRebaseThreshold, 18)
        )
        const allocateThreshold = parseFloat(
          ethers.utils.formatUnits(vaultAllocateThreshold, 18)
        )

        let swapGasUsage = 220000
        if (amount > allocateThreshold) {
          // https://etherscan.io/tx/0x267da9abae04ae600d33d2c3e0b5772872e6138eaa074ce715afc8975c7f2deb
          swapGasUsage = 2900000
        } else if (amount > rebaseTreshold) {
          // https://etherscan.io/tx/0xc8ac03e33cab4bad9b54a6e6604ef6b8e11126340b93bbca1348167f548ad8fd
          swapGasUsage = 510000
        }

        const approveGasUsage = approveAllowanceNeeded
          ? gasLimitForApprovingCoin(coinToSwap)
          : 0
        return {
          canDoSwap: true,
          gasUsed: swapGasUsage + approveGasUsage,
          swapGasUsage,
          approveGasUsage,
          approveAllowanceNeeded,
          amountReceived,
        }
      }

      const { minSwapAmount: minAmountReceived } = calculateSwapAmounts(
        amountReceived,
        coinToReceiveDecimals,
        priceToleranceValue
      )

      const gasEstimate = await mintVaultGasEstimate(
        swapAmount,
        minAmountReceived
      )

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        // TODO: should this be rather done with BigNumbers instead?
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating vault swap suitability: ${e.message}`
      )

      // local node and mainnet return errors in different formats, this handles both cases
      if (
        (e.data &&
          e.data.message &&
          e.data.message.includes('Mint amount lower than minimum')) ||
        e.message.includes('Mint amount lower than minimum')
      ) {
        return {
          canDoSwap: false,
          error: 'slippage_too_high',
        }
      }

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

    const amount = parseFloat(inputAmountRaw)
    // Check if Vault has allowance to spend coin.

    let gasEstimate
    try {
      await loadRedeemFee()
      const coinSplits = await _calculateSplits(amount)
      const splitsSum = coinSplits
        .map((coin) => parseFloat(coin.amount))
        .reduce((a, b) => a + b, 0)

      if (!userHasEnoughStablecoin('ousd', amount)) {
        return {
          canDoSwap: true,
          gasUsed: 1500000,
          amountReceived: splitsSum,
          coinSplits,
        }
      }

      const { minSwapAmount: minAmountReceived } = calculateSwapAmounts(
        splitsSum,
        coinToReceiveDecimals,
        priceToleranceValue
      )

      gasEstimate = await redeemVaultGasEstimate(swapAmount, minAmountReceived)

      return {
        canDoSwap: true,
        gasUsed: gasEstimate,
        // TODO: should this be rather done with BigNumbers instead?
        amountReceived: splitsSum,
        coinSplits,
      }
    } catch (e) {
      console.error(`Can not estimate contract call gas used: ${e.message}`)

      const errorIncludes = (errorTxt) => {
        return (
          (e.data && e.data.message && e.data.message.includes(errorTxt)) ||
          e.message.includes(errorTxt)
        )
      }

      // local node and mainnet return errors in different formats, this handles both cases
      if (errorIncludes('Redeem amount lower than minimum')) {
        return {
          canDoSwap: false,
          error: 'slippage_too_high',
        }
        /* Various error messages strategies emit when too much funds attempt to
         * be withdrawn:
         * - "Redeem failed" -> Compound strategy
         * - "5" -> Aave
         * - "Insufficient 3CRV balance" -> Convex
         */
      } else if (
        errorIncludes('Redeem failed') ||
        errorIncludes(`reverted with reason string '5'`) ||
        errorIncludes('Insufficient 3CRV balance')
      ) {
        return {
          canDoSwap: false,
          error: 'liquidity_error',
        }
      }

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

  // Fetches current eth price
  const fetchEthPrice = async () => {
    // if production
    if (chainId === 1) {
      return await _fetchEthPriceChainlink()
    } else {
      return await _fetchEthPriceCryptoApi()
    }
  }

  const _fetchEthPriceCryptoApi = async () => {
    try {
      const ethPriceRequest = await fetch(
        'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD'
      )

      // floor so we can convert to BN without a problem
      const ethPrice = BigNumber.from(
        Math.floor(get(await ethPriceRequest.json(), 'USD'))
      )
      setEthPrice(ethPrice)
      return ethPrice
    } catch (e) {
      console.error(`Can not fetch eth prices: ${e.message}`)
    }

    return BigNumber.from(0)
  }

  const _fetchGasPriceChainlink = async () => {
    if (chainId !== 1) {
      throw new Error('Chainlink fast gas supported only on mainnet')
    }

    try {
      const priceFeed =
        await contracts.chainlinkFastGasAggregator.latestRoundData()

      if (!isGasPriceUserOverriden) {
        ContractStore.update((s) => {
          s.gasPrice = priceFeed.answer
        })
      }
      return priceFeed.answer
    } catch (e) {
      console.error('Error happened fetching fast gas chainlink data:', e)
    }

    return BigNumber.from(0)
  }

  const _fetchEthPriceChainlink = async () => {
    try {
      const priceFeed = await contracts.chainlinkEthAggregator.latestRoundData()
      const ethUsdPrice = parseFloat(
        ethers.utils.formatUnits(priceFeed.answer, 8)
      )
      return ethUsdPrice
    } catch (e) {
      console.error('Error happened fetching eth usd chainlink data:', e)
    }

    return 0
  }

  // Fetches current gas price
  const fetchGasPrice = async () => {
    try {
      const gasPriceRequest = await fetchWithTimeout(
        `https://ethgasstation.info/api/ethgasAPI.json?api-key=${process.env.DEFI_PULSE_API_KEY}`,
        // allow for 5 seconds timeout before falling back to chainlink
        {
          timeout: 5000,
        }
      )

      const gasPrice = BigNumber.from(
        get(await gasPriceRequest.json(), 'average') + '00000000'
      )

      if (!isGasPriceUserOverriden) {
        ContractStore.update((s) => {
          s.gasPrice = gasPrice
        })
      }
      return gasPrice
    } catch (e) {
      console.error(
        `Can not fetch gas prices, using chainlink as fallback method: ${e.message}`
      )
    }

    // fallback to chainlink
    return await _fetchGasPriceChainlink()
  }

  const _calculateSplits = async (sellAmount) => {
    const calculateIt = async () => {
      try {
        const assetAmounts = await contracts.vault.calculateRedeemOutputs(
          ethers.utils.parseUnits(sellAmount.toString(), 18)
        )

        const assets = await Promise.all(
          (
            await contracts.vault.getAllAssets()
          ).map(async (address, index) => {
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
    estimateSwapSuitabilityUniswapV3,
    estimateSwapSuitabilityCurve,
  }
}

export default useSwapEstimator
