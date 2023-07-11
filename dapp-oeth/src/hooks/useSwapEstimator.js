import React, { useEffect, useState } from 'react'
import { ethers, BigNumber } from 'ethers'
import { useStoreState } from 'pullstate'
import { get, minBy } from 'lodash'
import AccountStore from 'stores/AccountStore'
import { approveCoinGasLimits, max_price } from 'utils/constants'
import { usePrevious } from 'utils/hooks'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import ContractStore from 'stores/ContractStore'
import { calculateSwapAmounts } from 'utils/math'
import fetchWithTimeout from 'utils/fetchWithTimeout'
import { find } from 'lodash'

const parseFloatBN = (value) => parseFloat(ethers.utils.formatEther(value))

const errorIncludes = (e, errorTxt) => {
  return (
    (e.data && e.data.message && e.data.message.includes(errorTxt)) ||
    e.message.includes(errorTxt)
  )
}

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
    coinInfoList[swapMode === 'mint' ? selectedCoin : 'oeth'] || {}

  const coinToSwap = swapMode === 'redeem' ? 'oeth' : selectedCoin

  const [selectedCoinPrev, setSelectedCoinPrev] = useState()

  let coinToReceiveContract, coinToReceiveDecimals

  const decimals = 18

  // do not enter conditional body when redeeming a mix
  if (!(swapMode === 'redeem' && selectedCoin === 'mix')) {
    ;({ contract: coinToReceiveContract, decimals: coinToReceiveDecimals } =
      coinInfoList[swapMode === 'redeem' ? selectedCoin : 'oeth']) || {}
  }

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.oeth !== undefined &&
    allowances.frxeth !== undefined &&
    allowances.sfrxeth !== undefined &&
    allowances.reth !== undefined &&
    allowances.weth !== undefined &&
    allowances.steth !== undefined

  const account = useStoreState(AccountStore, (s) => s.account)

  const [estimationCallback, setEstimationCallback] = useState(null)

  const {
    mintVaultGasEstimate,
    swapCurveGasEstimate,
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
      find(Object.values(swapEstimations), (estimation) => {
        return userSelectionExists ? estimation.userSelected : estimation.isBest
      })

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

    /*
     * When function is triggered because of a non user change in gas price, ignore the trigger.
     */
    if (!isGasPriceUserOverriden && previousGasPrice !== gasPrice) {
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

    const [
      vaultResult,
      zapperResult,
      // uniswapResult,
      // uniswapV2Result,
      // sushiswapResult,
      curveResult,
      ethPrice,
    ] = await Promise.all([
      swapMode === 'mint'
        ? estimateMintSuitabilityVault()
        : estimateRedeemSuitabilityVault(),
      estimateSwapSuitabilityZapper(),
      estimateSwapSuitabilityCurve(),
      fetchEthPrice(),
    ])

    if (!isGasPriceUserOverriden) {
      usedGasPrice = await fetchGasPrice()
    }

    let estimations = {
      vault: vaultResult,
      zapper: zapperResult,
      // uniswap: uniswapResult,
      curve: curveResult,
      // uniswapV2: uniswapV2Result,
      // sushiswap: sushiswapResult,
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
      value.coinToSwap = swapMode === 'mint' ? 'OETH' : selectedCoin
      value.swapMode = swapMode
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

      estimation.gasEstimateEth =
        (parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei')) *
          parseFloat(estimation.gasUsed)) /
        100000000

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
        ((inputAmount + estimation.gasEstimateEth) / amountReceivedNumber) *
        ethPrice

      if (amountReceivedNumber > 0) {
        const costWithGas = amountReceivedNumber + estimation.gasEstimateEth
        estimation.costMinusGasFees = costWithGas
        estimation.costMinusGasFeesUsd = costWithGas * ethPrice
        estimation.amountReceivedUsd = amountReceivedNumber * ethPrice
      }
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
    const gasInGwei = ethers.utils.formatUnits(gasPrice, 'gwei')
    // gwei offset
    return (
      (parseFloat(gasLimit) * parseFloat(gasInGwei) * flooredEth) / 100000000
    )
  }

  const userHasEnoughStablecoin = (coin, swapAmount) => {
    return parseFloat(balances[coin]) > swapAmount
  }

  /* Gives information on suitability of Zapper for this swap
   */
  const estimateSwapSuitabilityZapper = async () => {
    const amount = parseFloat(inputAmountRaw)
    // if (amount > 2.5) {
    //   // TODO: Check value against contract
    //   return {
    //     canDoSwap: false,
    //     error: 'amount_too_high',
    //   }
    // }

    if (swapMode === 'redeem' || !['eth', 'sfrxeth'].includes(selectedCoin)) {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    if (selectedCoin === 'eth') {
      const swapGasUsage = 90000 // TODO: Update this

      return {
        canDoSwap: true,
        gasUsed: swapGasUsage,
        swapGasUsage,
        approveGasUsage: 0,
        approveAllowanceNeeded: false,
        inputAmount: parseFloat(inputAmountRaw),
        amountReceived: amount,
      }
    }

    let amountReceived = amount

    if (coinToSwap === 'sfrxeth') {
      const [estimatedDeposit, frxEthMintPrice] = await Promise.all([
        contracts.sfrxeth
          .previewRedeem(ethers.utils.parseUnits(String(amount)))
          .then(parseFloatBN),
        contracts.vault
          .priceUnitMint(contracts.frxeth.address)
          .then(parseFloatBN),
      ])
      // previewRedeem * frxETH price should give a mint estimate receive
      amountReceived = estimatedDeposit * frxEthMintPrice
    }

    const approveAllowanceNeeded = allowancesLoaded
      ? parseFloat(allowances[coinToSwap].zapper) < amount
      : true
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
      inputAmount: parseFloat(inputAmountRaw),
      amountReceived,
    }
  }

  /* Gives information on suitability of Curve for this swap
   */
  const estimateSwapSuitabilityCurve = async () => {
    const isRedeem = swapMode === 'redeem'
    const curveRegistryCoins = ['steth', 'reth', 'weth', 'frxeth']

    if (
      (isRedeem && selectedCoin === 'mix') ||
      !['eth', 'oeth', ...curveRegistryCoins].includes(selectedCoin)
    ) {
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
        isRedeem ? coinToReceiveDecimals || 18 : 18
      )

      const isPriceHigh =
        ethers.utils.formatUnits(swapAmount, decimals) / amountReceived >
        max_price

      if (isPriceHigh) {
        return {
          canDoSwap: false,
          error: 'price_too_high',
        }
      }

      if (coinToSwap === 'eth' && swapMode === 'mint') {
        const swapGasUsage = 90000 // TODO: Update this

        return {
          canDoSwap: true,
          gasUsed: swapGasUsage,
          swapGasUsage,
          approveGasUsage: 0,
          approveAllowanceNeeded: false,
          inputAmount: parseFloat(inputAmountRaw),
          amountReceived,
        }
      }

      /* Check if Curve router has allowance to spend coin. If not we can not run gas estimation and need
       * to guess the gas usage.
       *
       * We don't check if positive amount is large enough: since we always approve max_int allowance.
       */

      const allowanceCheckKey =
        (swapMode === 'mint' &&
          selectedCoin === 'oeth' &&
          curveRegistryCoins.includes(coinToSwap)) ||
        (swapMode === 'redeem' &&
          coinToSwap === 'oeth' &&
          curveRegistryCoins.includes(selectedCoin))
          ? 'curve_registry'
          : 'curve'

      // ETH / OETH mint flow
      const approveAllowanceNeeded = allowancesLoaded
        ? parseFloat(allowances[coinToSwap]?.[allowanceCheckKey]) <
          parseFloat(inputAmountRaw)
        : true

      const hasEnoughBalance = userHasEnoughStablecoin(
        coinToSwap,
        parseFloat(inputAmountRaw)
      )

      if (approveAllowanceNeeded || !hasEnoughBalance) {
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
           */
          gasUsed: swapGasUsage + approveGasUsage,
          swapGasUsage,
          approveGasUsage,
          approveAllowanceNeeded,
          inputAmount: parseFloat(inputAmountRaw),
          amountReceived,
          hasEnoughBalance,
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
        inputAmount: parseFloat(inputAmountRaw),
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating curve swap suitability: ${e?.message}`
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
    const amount = parseFloat(inputAmountRaw)

    if (['eth', 'sfrxeth'].includes(selectedCoin)) {
      return {
        canDoSwap: false,
        error: 'unsupported',
      }
    }

    try {
      // 18 decimals denominated BN exchange rate value
      const oracleCoinPrice = await contracts.vault.priceUnitMint(
        coinToSwapContract.address
      )
      const amountReceived =
        amount * parseFloat(ethers.utils.formatUnits(oracleCoinPrice, 18))

      const approveAllowanceNeeded = allowancesLoaded
        ? parseFloat(allowances[coinToSwap].vault) < amount
        : true

      // Check if Vault has allowance to spend coin.

      const hasEnoughBalance = userHasEnoughStablecoin(selectedCoin, amount)

      if (approveAllowanceNeeded || !hasEnoughBalance) {
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
          inputAmount: parseFloat(inputAmountRaw),
          amountReceived,
          hasEnoughBalance,
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
        inputAmount: parseFloat(inputAmountRaw),
        amountReceived,
      }
    } catch (e) {
      console.error(
        `Unexpected error estimating vault swap suitability: ${e.message}`
      )

      // local node and mainnet return errors in different formats, this handles both cases
      if (errorIncludes(e, 'Mint amount lower than minimum')) {
        return {
          canDoSwap: false,
          error: 'price_too_high',
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

      const hasEnoughBalance = userHasEnoughStablecoin('oeth', amount)

      if (!hasEnoughBalance) {
        return {
          canDoSwap: true,
          gasUsed: 1500000,
          inputAmount: parseFloat(inputAmountRaw),
          amountReceived: splitsSum,
          coinSplits,
          hasEnoughBalance,
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
        inputAmount: parseFloat(inputAmountRaw),
        amountReceived: splitsSum,
        coinSplits,
      }
    } catch (e) {
      console.error(`Can not estimate contract call gas used: ${e.message}`)

      // local node and mainnet return errors in different formats, this handles both cases
      if (errorIncludes(e, 'Redeem amount lower than minimum')) {
        return {
          canDoSwap: false,
          error: 'price_too_high',
        }
        /* Various error messages strategies emit when too much funds attempt to
         * be withdrawn:
         * - "Redeem failed" -> Compound strategy
         * - "5" -> Aave
         * - "Insufficient 3CRV balance" -> Convex
         */
      } else if (
        errorIncludes(e, 'Redeem failed') ||
        errorIncludes(e, `reverted with reason string '5'`) ||
        errorIncludes(e, 'Insufficient 3CRV balance')
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
      return Math.floor(get(await ethPriceRequest.json(), 'USD'))
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
      return Math.floor(
        parseFloat(ethers.utils.formatUnits(priceFeed.answer, 8))
      )
    } catch (e) {
      console.error('Error happened fetching eth usd chainlink data:', e)
    }

    return 0
  }

  // Fetches current gas price
  const fetchGasPrice = async () => {
    try {
      const provider = new ethers.providers.StaticJsonRpcProvider(
        process.env.NEXT_PUBLIC_ETHEREUM_RPC_PROVIDER,
        { chainId: parseInt(process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID) }
      )

      const data = await provider.getFeeData()

      const gasPrice = data?.gasPrice

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
    estimateSwapSuitabilityZapper,
    estimateMintSuitabilityVault,
    estimateRedeemSuitabilityVault,
    estimateSwapSuitabilityCurve,
  }
}

export default useSwapEstimator
