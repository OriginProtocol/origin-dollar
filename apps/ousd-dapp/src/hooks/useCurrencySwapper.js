import React, { useEffect, useState } from 'react'
import { ethers, BigNumber } from 'ethers'
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
} from 'utils/constants'
import { useWeb3React } from '@web3-react/core'
import { find } from 'lodash'
import addresses from 'constants/contractAddresses'

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
    flipper,
    uniV3SwapRouter,
    uniV2Router,
    sushiRouter,
    uniV3SwapQuoter,
    curveRegistryExchange,
    curveOUSDMetaPool,
  } = useStoreState(ContractStore, (s) => s.contracts)
  const curveMetapoolUnderlyingCoins = useStoreState(
    ContractStore,
    (s) => s.curveMetapoolUnderlyingCoins
  )

  const coinInfoList = useStoreState(ContractStore, (s) => s.coinInfoList)

  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const account = useStoreState(AccountStore, (s) => s.address)
  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const swapsLoaded = swapEstimations && typeof swapEstimations === 'object'
  const selectedSwap = useStoreState(ContractStore, (s) => s.selectedSwap)
  const web3react = useWeb3React()
  const { library } = web3react

  const allowancesLoaded =
    typeof allowances === 'object' &&
    allowances.ousd &&
    allowances.usdt &&
    allowances.usdc &&
    allowances.dai

  const connSigner = (contract) => {
    return contract.connect(library.getSigner(account))
  }

  const { contract: coinContract, decimals } =
    coinInfoList[swapMode === 'mint' ? selectedCoin : 'ousd']

  let coinToReceiveDecimals, coinToReceiveContract
  // do not enter conditional body when redeeming a mix
  if (!(swapMode === 'redeem' && selectedCoin === 'mix')) {
    ;({ contract: coinToReceiveContract, decimals: coinToReceiveDecimals } =
      coinInfoList[swapMode === 'redeem' ? selectedCoin : 'ousd'])
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
      flipper: 'flipper',
      uniswap: 'uniswapV3Router',
      uniswapV2: 'uniswapV2Router',
      curve: 'curve',
      sushiswap: 'sushiRouter',
    }

    const coinNeedingApproval = swapMode === 'mint' ? selectedCoin : 'ousd'

    if (coinNeedingApproval === 'ousd' && selectedSwap.name === 'vault') {
      setNeedsApproval(false)
    } else {
      if (nameMaps[selectedSwap.name] === undefined) {
        throw new Error(
          `Can not fetch contract: ${selectedSwap.name} allowance for coin: ${coinNeedingApproval}`
        )
      }

      setNeedsApproval(
        Object.keys(allowances).length > 0 &&
          parseFloat(
            allowances[coinNeedingApproval][nameMaps[selectedSwap.name]]
          ) < amount
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
    const isRedeemAll = Math.abs(swapAmount - balances.ousd) < 1
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

  const swapFlipper = async () => {
    // need to calculate these again, since Flipper takes all amount inputs in 18 decimal format
    const { swapAmount: swapAmountFlipper } = calculateSwapAmounts(
      inputAmountRaw,
      18
    )

    let flipperResult
    if (swapMode === 'mint') {
      if (selectedCoin === 'dai') {
        flipperResult = await connSigner(flipper).buyOusdWithDai(
          swapAmountFlipper
        )
      } else if (selectedCoin === 'usdt') {
        flipperResult = await connSigner(flipper).buyOusdWithUsdt(
          swapAmountFlipper
        )
      } else if (selectedCoin === 'usdc') {
        flipperResult = await connSigner(flipper).buyOusdWithUsdc(
          swapAmountFlipper
        )
      }
    } else {
      if (selectedCoin === 'dai') {
        flipperResult = await connSigner(flipper).sellOusdForDai(
          swapAmountFlipper
        )
      } else if (selectedCoin === 'usdt') {
        flipperResult = await connSigner(flipper).sellOusdForUsdt(
          swapAmountFlipper
        )
      } else if (selectedCoin === 'usdc') {
        flipperResult = await connSigner(flipper).sellOusdForUsdc(
          swapAmountFlipper
        )
      }
    }

    return {
      result: flipperResult,
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
    const swapParams = [
      curveMetapoolUnderlyingCoins.indexOf(coinContract.address.toLowerCase()),
      curveMetapoolUnderlyingCoins.indexOf(
        coinToReceiveContract.address.toLowerCase()
      ),
      swapAmount,
      minSwapAmount,
    ]

    const gasLimit = increaseGasLimitByBuffer(
      await curveOUSDMetaPool.estimateGas.exchange_underlying(...swapParams, {
        from: account,
      }),
      curveGasLimitBuffer
    )

    if (isGasEstimate) {
      return gasLimit
    } else {
      return await connSigner(curveOUSDMetaPool).exchange_underlying(
        ...swapParams,
        { gasLimit }
      )
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
    const coinsReceived = await curveRegistryExchange.get_exchange_amount(
      addresses.mainnet.CurveOUSDMetaPool,
      coinContract.address,
      coinToReceiveContract.address,
      swapAmount,
      {
        gasLimit: 1000000,
      }
    )

    return coinsReceived
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
    swapFlipper,
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
