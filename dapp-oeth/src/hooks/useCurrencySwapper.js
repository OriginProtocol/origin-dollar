import React, { useEffect, useState } from 'react'
import { BigNumber } from 'ethers'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import AccountStore from 'stores/AccountStore'
import {
  mintAbsoluteGasLimitBuffer,
  mintPercentGasLimitBuffer,
  redeemPercentGasLimitBuffer,
  uniswapV2GasLimitBuffer,
  sushiswapGasLimitBuffer,
  uniswapV3GasLimitBuffer,
  curveGasLimitBuffer,
  NullAddress,
} from 'utils/constants'
import { useSigner } from 'wagmi'
import addresses from 'constants/contractAddresses'
import curveRoutes from 'constants/curveRoutes'
import { get } from 'lodash'
import { calculateSwapAmounts } from 'utils/math'

const useCurrencySwapper = ({
  swapMode,
  inputAmountRaw,
  outputAmount,
  selectedCoin,
  priceToleranceValue,
}) => {
  const [needsApproval, setNeedsApproval] = useState(false)
  const {
    vault: vaultContract,
    ousd: ousdContract,
    usdt: usdtContract,
    usdc: usdcContract,
    dai: daiContract,
    uniV3SwapRouter,
    uniV2Router,
    sushiRouter,
    uniV3SwapQuoter,
    curveRegistryExchange,
    curveOETHPool,
    zapper,
  } = useStoreState(ContractStore, (s) => s.contracts)
  const curveUnderlyingCoins = useStoreState(
    ContractStore,
    (s) => s.curveUnderlyingCoins
  )

  const coinInfoList = useStoreState(ContractStore, (s) => s.coinInfoList)
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const account = useStoreState(AccountStore, (s) => s.address)
  const selectedSwap = useStoreState(ContractStore, (s) => s.selectedSwap)
  const { data: signer } = useSigner()
  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.oeth &&
    allowances.weth &&
    allowances.reth &&
    allowances.frxeth &&
    allowances.sfrxeth &&
    allowances.steth

  const connSigner = (contract) => {
    return contract.connect(signer)
  }

  const { contract: coinContract, decimals } =
    coinInfoList[swapMode === 'mint' ? selectedCoin : 'oeth']

  let coinToReceiveDecimals, coinToReceiveContract
  // do not enter conditional body when redeeming a mix
  if (!(swapMode === 'redeem' && selectedCoin === 'mix')) {
    ;({ contract: coinToReceiveContract, decimals: coinToReceiveDecimals } =
      coinInfoList[swapMode === 'redeem' ? selectedCoin : 'oeth'])
  }

  // plain amount as displayed in UI (not in wei format)
  const amount = parseFloat(inputAmountRaw)

  const { swapAmount, minSwapAmount } = calculateSwapAmounts(
    inputAmountRaw,
    decimals,
    priceToleranceValue
  )

  useEffect(() => {
    if (
      !amount ||
      !selectedSwap ||
      !allowances ||
      Object.keys(allowances) === 0
    ) {
      return
    }

    const nameMaps = {
      vault: 'vault',
      zapper: 'zapper',
      // uniswap: 'uniswapV3Router',
      // uniswapV2: 'uniswapV2Router',
      curve: 'curve',
      // sushiswap: 'sushiRouter',
    }

    const coinNeedingApproval = swapMode === 'mint' ? selectedCoin : 'oeth'

    if (
      coinNeedingApproval === 'eth' ||
      (coinNeedingApproval === 'oeth' && selectedSwap.name === 'vault')
    ) {
      setNeedsApproval(false)
    } else {
      if (nameMaps[selectedSwap.name] === undefined) {
        throw new Error(
          `Can not fetch contract: ${selectedSwap.name} allowance for coin: ${coinNeedingApproval}`
        )
      }

      const curveRegistryCoins = ['steth', 'weth', 'reth', 'frxeth']

      let allowanceCheckKey = nameMaps[selectedSwap.name]

      if (selectedSwap.name === 'curve') {
        allowanceCheckKey =
          (swapMode === 'mint' &&
            selectedCoin === 'oeth' &&
            curveRegistryCoins.includes(coinNeedingApproval)) ||
          (swapMode === 'redeem' &&
            coinNeedingApproval === 'oeth' &&
            curveRegistryCoins.includes(selectedCoin))
            ? 'curve_registry'
            : 'curve'
      }

      const allowance = parseFloat(
        get(allowances, `${coinNeedingApproval}.${allowanceCheckKey}`)
      )

      setNeedsApproval(
        Object.keys(allowances).length > 0 && allowance < amount
          ? selectedSwap.name
          : false
      )
    }
  }, [swapMode, amount, allowances, selectedCoin, selectedSwap])

  const _mintVault = async (
    callObject,
    swapAmount,
    minSwapAmount,
    txParams = {}
  ) => {
    return await callObject.mint(
      coinContract.address,
      swapAmount,
      minSwapAmount,
      txParams
    )
  }

  /* Increases the given gas limit by the specified buffer. BufferToIncrease is expressed
   * in relative percentages. Meaning a 0.2 value will set gasLimit to 120% of the original value
   */
  const increaseGasLimitByBuffer = (gasLimit, bufferToIncrease) => {
    return Math.round(gasLimit * (1 + bufferToIncrease))
  }

  const mintVaultGasEstimate = async (swapAmount, minSwapAmount) => {
    const gasEstimate = (
      await _mintVault(vaultContract.estimateGas, swapAmount, minSwapAmount, {
        from: account,
      })
    ).toNumber()

    return parseInt(
      gasEstimate +
        Math.max(
          mintAbsoluteGasLimitBuffer,
          gasEstimate * mintPercentGasLimitBuffer
        )
    )
  }

  const mintVault = async () => {
    const { minSwapAmount: minSwapAmountReceived } = calculateSwapAmounts(
      outputAmount,
      18,
      priceToleranceValue
    )

    const gasLimit = await mintVaultGasEstimate(
      swapAmount,
      minSwapAmountReceived
    )

    return {
      result: await _mintVault(
        connSigner(vaultContract),
        swapAmount,
        minSwapAmountReceived,
        {
          gasLimit,
        }
      ),
      swapAmount,
      minSwapAmount: minSwapAmountReceived,
    }
  }

  const _redeemVault = async (
    callObject,
    swapAmount,
    minSwapAmount,
    txParams = {}
  ) => {
    const isRedeemAll = Math.abs(swapAmount - balances.oeth) < 1
    if (isRedeemAll) {
      return await callObject.redeemAll(minSwapAmount, txParams)
    } else {
      return await callObject.redeem(swapAmount, minSwapAmount, txParams)
    }
  }

  const redeemVaultGasEstimate = async (swapAmount, minSwapAmount) => {
    return increaseGasLimitByBuffer(
      await _redeemVault(vaultContract.estimateGas, swapAmount, minSwapAmount, {
        from: account,
      }),
      redeemPercentGasLimitBuffer
    )
  }

  const redeemVault = async () => {
    const { minSwapAmount: minSwapAmountReceived } = calculateSwapAmounts(
      outputAmount,
      18,
      priceToleranceValue
    )

    const gasLimit = await redeemVaultGasEstimate(
      swapAmount,
      minSwapAmountReceived
    )

    return {
      result: await _redeemVault(
        connSigner(vaultContract),
        swapAmount,
        minSwapAmountReceived,
        {
          gasLimit,
        }
      ),
      swapAmount,
      minSwapAmount: minSwapAmountReceived,
    }
  }

  const swapZapper = async () => {
    const { swapAmount: amount, minSwapAmount: minAmount } =
      calculateSwapAmounts(inputAmountRaw, 18)

    let zapperResult

    if (selectedCoin === 'eth') {
      zapperResult = await connSigner(zapper).deposit({
        value: amount,
      })
    } else if (selectedCoin === 'sfrxeth') {
      zapperResult = await connSigner(zapper).depositSFRXETH(amount, minAmount)
    }

    return {
      result: zapperResult,
      swapAmount,
      minSwapAmount,
    }
  }

  /* Path is an array of strings -> contains all pool pairs enumerated
   * Fees is an array of numbers -> identifying the pool fees of the pairs
   */
  const _encodeUniswapPath = (path, fees) => {
    const FEE_SIZE = 3

    if (path.length != fees.length + 1) {
      throw new Error('path/fee lengths do not match')
    }

    let encoded = '0x'
    for (let i = 0; i < fees.length; i++) {
      // 20 byte encoding of the address
      encoded += path[i].slice(2)
      // 3 byte encoding of the fee
      encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
    }
    // encode the final token
    encoded += path[path.length - 1].slice(2)

    return encoded.toLowerCase()
  }

  const _encodePath = () => {
    const isMintMode = swapMode === 'mint'
    let path

    if (selectedCoin === 'dai') {
      /* Uniswap now supports 0.01% fees on stablecoin pools
       * TODO: can't get the 0.01% pool to work for DAI even though it is obviously available:
       *
       * - https://info.uniswap.org/#/pools/0x3416cf6c708da44db2624d63ea0aaef7113527c6 -> 0.01%
       */
      if (isMintMode) {
        path = _encodeUniswapPath(
          [daiContract.address, usdtContract.address, ousdContract.address],
          [500, 500]
        )
      } else {
        path = _encodeUniswapPath(
          [ousdContract.address, usdtContract.address, daiContract.address],
          [500, 500]
        )
      }
    } else if (selectedCoin === 'usdc') {
      /* Uniswap now supports 0.01% fees on stablecoin pools
       *
       * - https://info.uniswap.org/#/pools/0x5777d92f208679db4b9778590fa3cab3ac9e2168 -> 0.01%
       */
      if (isMintMode) {
        path = _encodeUniswapPath(
          [usdcContract.address, usdtContract.address, ousdContract.address],
          [100, 500]
        )
      } else {
        path = _encodeUniswapPath(
          [ousdContract.address, usdtContract.address, usdcContract.address],
          [500, 100]
        )
      }
    } else {
      throw new Error(
        `Unexpected uniswap params -> swapMode: ${swapMode} selectedCoin: ${selectedCoin}`
      )
    }

    return path
  }

  const _swapCurve = async (swapAmount, minSwapAmount, isGasEstimate) => {
    // Handle stETH, rETH, WETH, frxETH
    if (coinContract?.address && coinToReceiveContract?.address) {
      const { routes, swapParams } =
        curveRoutes[coinContract?.address]?.[coinToReceiveContract?.address]

      if (!routes) {
        throw new Error('No curve route found for contract address pair')
      }

      const estimatedGasLimit = await curveRegistryExchange.estimateGas[
        'exchange_multiple(address[9],uint256[3][4],uint256,uint256)'
      ](routes, swapParams, swapAmount, minSwapAmount, {
        from: account,
      })

      const gasLimit = increaseGasLimitByBuffer(
        estimatedGasLimit,
        curveGasLimitBuffer
      )

      if (isGasEstimate) {
        return gasLimit
      } else {
        return await connSigner(curveRegistryExchange)[
          'exchange_multiple(address[9],uint256[3][4],uint256,uint256)'
        ](routes, swapParams, swapAmount, minSwapAmount, {
          gasLimit,
        })
      }
    } else {
      const nullAddress = NullAddress?.toLowerCase()
      const fromAddress = coinContract?.address?.toLowerCase() || nullAddress
      const toAddress =
        coinToReceiveContract?.address?.toLowerCase() || nullAddress

      const swapParams = [
        curveUnderlyingCoins.indexOf(fromAddress),
        curveUnderlyingCoins.indexOf(toAddress),
        swapAmount,
        minSwapAmount,
      ]

      const overrides =
        fromAddress === nullAddress
          ? {
              value: swapAmount,
            }
          : {}

      const estimatedGasLimit = await curveOETHPool.estimateGas.exchange(
        ...swapParams,
        {
          from: account,
          ...overrides,
        }
      )

      const gasLimit = increaseGasLimitByBuffer(
        estimatedGasLimit,
        curveGasLimitBuffer
      )

      if (isGasEstimate) {
        return gasLimit
      } else {
        return await connSigner(curveOETHPool).exchange(...swapParams, {
          gasLimit,
          ...overrides,
        })
      }
    }
  }

  const swapCurveGasEstimate = async (swapAmount, minSwapAmount) => {
    return await _swapCurve(swapAmount, minSwapAmount, true)
  }

  const swapCurve = async () => {
    const { minSwapAmount: minSwapAmountReceived } = calculateSwapAmounts(
      outputAmount,
      coinToReceiveDecimals,
      priceToleranceValue
    )

    return {
      result: await _swapCurve(swapAmount, minSwapAmountReceived, false),
      swapAmount,
      minSwapAmount,
    }
  }

  const quoteCurve = async (swapAmount) => {
    // Not a ETH/OETH swap
    if (coinContract?.address && coinToReceiveContract?.address) {
      const { routes, swapParams } =
        curveRoutes[coinContract?.address]?.[coinToReceiveContract?.address]

      if (!routes) {
        throw new Error('No curve route found for contract address pair')
      }

      return curveRegistryExchange[
        'get_exchange_multiple_amount(address[9],uint256[3][4],uint256)'
      ](routes, swapParams, swapAmount, {
        gasLimit: 1000000,
      })
    } else {
      // ETH
      return curveRegistryExchange['get_exchange_amount'](
        addresses.mainnet.CurveOETHPool,
        // For Eth support
        coinContract?.address || NullAddress,
        coinToReceiveContract?.address || NullAddress,
        swapAmount,
        {
          gasLimit: 1000000,
        }
      )
    }
  }

  const _swapUniswap = async (swapAmount, minSwapAmount, isGasEstimate) => {
    const isMintMode = swapMode === 'mint'

    const swapWithIncreaseGasLimit = async (
      runEstimateFunction,
      runSwapFunction
    ) => {
      const gasLimit = await runEstimateFunction()
      if (isGasEstimate) {
        return gasLimit
      } else {
        return await runSwapFunction({ gasLimit })
      }
    }

    if (selectedCoin === 'usdt') {
      const singleCoinParams = [
        isMintMode ? usdtContract.address : ousdContract.address,
        isMintMode ? ousdContract.address : usdtContract.address,
        500, // pre-defined Factory fee for stablecoins
        account, // recipient
        BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
        swapAmount, // amountIn
        minSwapAmount, // amountOutMinimum
        0, // sqrtPriceLimitX96
      ]

      const runUsdtGasEstimate = async () => {
        return increaseGasLimitByBuffer(
          (
            await uniV3SwapRouter.estimateGas.exactInputSingle(
              singleCoinParams,
              { from: account }
            )
          ).toNumber(),
          uniswapV3GasLimitBuffer
        )
      }

      return await swapWithIncreaseGasLimit(
        runUsdtGasEstimate,
        async (txParams) => {
          return await connSigner(uniV3SwapRouter).exactInputSingle(
            singleCoinParams,
            txParams
          )
        }
      )
    }

    const path = _encodePath()
    const params = {
      path,
      recipient: account,
      deadline: BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now,
      amountIn: swapAmount,
      amountOutMinimum: minSwapAmount,
    }

    const data = [
      uniV3SwapRouter.interface.encodeFunctionData('exactInput', [params]),
    ]

    const runGasEstimate = async () => {
      return increaseGasLimitByBuffer(
        (
          await uniV3SwapRouter.estimateGas.exactInput(params, {
            from: account,
          })
        ).toNumber(),
        uniswapV3GasLimitBuffer
      )
    }

    return await swapWithIncreaseGasLimit(runGasEstimate, async (txParams) => {
      return await connSigner(uniV3SwapRouter).exactInput(params, txParams)
    })
  }

  const swapUniswapGasEstimate = async (swapAmount, minSwapAmount) => {
    return await _swapUniswap(swapAmount, minSwapAmount, true)
  }

  const swapUniswap = async () => {
    const { minSwapAmount: minSwapAmountReceived } = calculateSwapAmounts(
      outputAmount,
      coinToReceiveDecimals,
      priceToleranceValue
    )

    return {
      result: await _swapUniswap(swapAmount, minSwapAmountReceived, false),
      swapAmount,
      minSwapAmount,
    }
  }

  const quoteUniswap = async (swapAmount) => {
    const isMintMode = swapMode === 'mint'

    if (selectedCoin === 'usdt') {
      return await uniV3SwapQuoter.callStatic.quoteExactInputSingle(
        isMintMode ? usdtContract.address : ousdContract.address,
        isMintMode ? ousdContract.address : usdtContract.address,
        500, // pre-defined Factory fee for stablecoins
        swapAmount,
        0 // sqrtPriceLimitX96
      )
    }

    const path = _encodePath()
    return await uniV3SwapQuoter.callStatic.quoteExactInput(path, swapAmount)
  }

  const _swapUniswapV2 = async (
    swapAmount,
    minSwapAmount,
    isGasEstimate,
    isSushiSwap = false
  ) => {
    const isMintMode = swapMode === 'mint'
    const contract = isSushiSwap ? sushiRouter : uniV2Router
    const swapCallParams = [
      swapAmount, // amountIn
      minSwapAmount, // amountOutMinimum
      getUniV2Path(), // swap path
      account, // recipient
      BigNumber.from(Date.now() + 2 * 60 * 1000), // deadline - 2 minutes from now
    ]

    const txParams = { from: account }
    const gasLimit = increaseGasLimitByBuffer(
      await contract.estimateGas.swapExactTokensForTokens(
        ...swapCallParams,
        txParams
      ),
      isSushiSwap ? sushiswapGasLimitBuffer : uniswapV2GasLimitBuffer
    )

    if (isGasEstimate) {
      return gasLimit
    } else {
      txParams.gasLimit = gasLimit
      return await connSigner(contract).swapExactTokensForTokens(
        ...swapCallParams,
        txParams
      )
    }
  }

  const swapUniswapV2GasEstimate = async (swapAmount, minSwapAmount) => {
    return await _swapUniswapV2(swapAmount, minSwapAmount, true)
  }

  const _swapUniswapV2Variant = async (isSushiSwap = false) => {
    const { minSwapAmount: minSwapAmountReceived } = calculateSwapAmounts(
      outputAmount,
      coinToReceiveDecimals,
      priceToleranceValue
    )

    return {
      result: await _swapUniswapV2(
        swapAmount,
        minSwapAmountReceived,
        false,
        isSushiSwap
      ),
      swapAmount,
      minSwapAmount,
    }
  }

  const swapUniswapV2 = async () => {
    return _swapUniswapV2Variant(false)
  }

  const swapSushiSwap = async () => {
    return _swapUniswapV2Variant(true)
  }

  const swapSushiswapGasEstimate = async (swapAmount, minSwapAmount) => {
    return await _swapUniswapV2(swapAmount, minSwapAmount, true, true)
  }

  const getUniV2Path = () => {
    const isMintMode = swapMode === 'mint'
    let path

    if (selectedCoin === 'dai') {
      if (isMintMode) {
        path = [daiContract.address, usdtContract.address, ousdContract.address]
      } else {
        path = [ousdContract.address, usdtContract.address, daiContract.address]
      }
    } else if (selectedCoin === 'usdc') {
      if (isMintMode) {
        path = [
          usdcContract.address,
          usdtContract.address,
          ousdContract.address,
        ]
      } else {
        path = [
          ousdContract.address,
          usdtContract.address,
          usdcContract.address,
        ]
      }
    } else if (selectedCoin === 'usdt') {
      if (isMintMode) {
        path = [usdtContract.address, ousdContract.address]
      } else {
        path = [ousdContract.address, usdtContract.address]
      }
    } else {
      throw new Error(
        `Unexpected uniswap V2 params -> swapMode: ${swapMode} selectedCoin: ${selectedCoin}`
      )
    }

    return path
  }

  const quoteSushiSwap = async (swapAmount) => {
    return await sushiRouter.getAmountsOut(swapAmount, getUniV2Path())
  }

  const quoteUniswapV2 = async (swapAmount) => {
    return await uniV2Router.getAmountsOut(swapAmount, getUniV2Path())
  }

  return {
    allowancesLoaded,
    needsApproval,
    mintVault,
    mintVaultGasEstimate,
    redeemVault,
    redeemVaultGasEstimate,
    swapZapper,
    swapUniswapGasEstimate,
    swapUniswap,
    swapUniswapV2GasEstimate,
    swapUniswapV2,
    quoteUniswap,
    quoteUniswapV2,
    quoteSushiSwap,
    swapSushiSwap,
    swapSushiswapGasEstimate,
    quoteCurve,
    swapCurve,
    swapCurveGasEstimate,
  }
}

export default useCurrencySwapper
