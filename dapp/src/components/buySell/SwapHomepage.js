import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import ErrorModal from 'components/buySell/ErrorModal'
import { currencies } from 'constants/Contract'
import withRpcProvider from 'hoc/withRpcProvider'
import usePriceTolerance from 'hooks/usePriceTolerance'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import SwapCurrencyPill from 'components/buySell/SwapCurrencyPill'
import PillArrow from 'components/buySell/_PillArrow'
import SettingsDropdown from 'components/buySell/SettingsDropdown'
import useSwapEstimator from 'hooks/useSwapEstimator'
import withIsMobile from 'hoc/withIsMobile'
import { getUserSource } from 'utils/user'
import usePrevious from 'utils/usePrevious'
import ApproveSwap from 'components/buySell/ApproveSwap'

import analytics from 'utils/analytics'
import { formatCurrencyMinMaxDecimals, removeCommas } from '../../utils/math'

let ReactPixel
if (process.browser) {
  ReactPixel = require('react-facebook-pixel').default
}

const lastUserSelectedCoinKey = 'last_user_selected_coin'
const lastSelectedSwapModeKey = 'last_user_selected_swap_mode'

const SwapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const swapsLoaded = swapEstimations && typeof swapEstimations === 'object'
  const selectedSwap = useStoreState(ContractStore, (s) => s.selectedSwap)

  // mint / redeem
  const [swapMode, setSwapMode] = useState(
    localStorage.getItem(lastSelectedSwapModeKey) || 'mint'
  )
  const previousSwapMode = usePrevious(swapMode)
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)

  const storedSelectedCoin = localStorage.getItem(lastUserSelectedCoinKey)
  // Just in case inconsistent state happens where selected coin is mix and mode mint, reset selected coin to dai
  const defaultSelectedCoinValue =
    (storedSelectedCoin === 'mix' && swapMode === 'mint'
      ? 'dai'
      : storedSelectedCoin) || 'dai'
  const [selectedBuyCoin, setSelectedBuyCoin] = useState(
    defaultSelectedCoinValue
  )
  const [selectedRedeemCoin, setSelectedRedeemCoin] = useState(
    defaultSelectedCoinValue
  )
  const [selectedBuyCoinAmount, setSelectedBuyCoinAmount] = useState('')
  const [selectedRedeemCoinAmount, setSelectedRedeemCoinAmount] = useState('')
  const [balanceError, setBalanceError] = useState(null)
  const { setPriceToleranceValue, priceToleranceValue } =
    usePriceTolerance('mint')

  const swappingGloballyDisabled = process.env.DISABLE_SWAP_BUTTON === 'true'

  const swapParams = (rawCoinAmount, outputAmount) => {
    return {
      swapMode,
      inputAmountRaw: rawCoinAmount,
      outputAmount,
      selectedCoin: swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin,
      priceToleranceValue,
    }
  }

  const round0to6DecimalsNoCommas = (value) => {
    return removeCommas(
      formatCurrencyMinMaxDecimals(value, {
        minDecimals: 0,
        maxDecimals: 6,
        truncate: true,
      })
    )
  }

  useSwapEstimator(
    swapParams(
      // This is added so that onBlur on input field (that sometimes adds decimals) doesn't trigger swap estimation
      round0to6DecimalsNoCommas(
        swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount
      ),
      round0to6DecimalsNoCommas(
        swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount
      )
    )
  )

  const {
    allowancesLoaded,
    needsApproval,
    mintVault,
    redeemVault,
    swapFlipper,
    swapUniswap,
    swapUniswapV2,
    swapSushiSwap,
    swapCurve,
  } = useCurrencySwapper(
    swapParams(
      swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount,
      selectedSwap ? selectedSwap.amountReceived : 0
    )
  )

  useEffect(() => {
    let lastUserSelectedCoin = localStorage.getItem(lastUserSelectedCoinKey)

    if (swapMode === 'mint') {
      setSelectedRedeemCoin('ousd')
      // TODO: when user comes from 'mix' coin introduce the new empty field
      if (lastUserSelectedCoin === 'mix') {
        lastUserSelectedCoin = 'dai'
        localStorage.setItem(lastUserSelectedCoinKey, 'dai')
      }
      setSelectedBuyCoin(lastUserSelectedCoin || 'dai')
    } else {
      setSelectedBuyCoin('ousd')
      setSelectedRedeemCoin(lastUserSelectedCoin || 'dai')
    }

    // currencies flipped
    if (previousSwapMode !== swapMode) {
      localStorage.setItem(lastSelectedSwapModeKey, swapMode)
      if (selectedSwap) {
        const otherCoinAmount =
          Math.floor(selectedSwap.amountReceived * 1000000) / 1000000
        setSelectedBuyCoinAmount(Math.floor(otherCoinAmount * 100) / 100)
        setSelectedRedeemCoinAmount(Math.floor(otherCoinAmount * 100) / 100)
      }
    }
  }, [swapMode])

  const userSelectsBuyCoin = (coin) => {
    // treat it as a flip
    if (coin === 'ousd') {
      setSwapMode(swapMode === 'mint' ? 'redeem' : 'mint')
      return
    }
    localStorage.setItem(lastUserSelectedCoinKey, coin)
    setSelectedBuyCoin(coin)
  }

  const userSelectsRedeemCoin = (coin) => {
    // treat it as a flip
    if (coin === 'ousd') {
      setSwapMode(swapMode === 'mint' ? 'redeem' : 'mint')
      return
    }
    localStorage.setItem(lastUserSelectedCoinKey, coin)
    setSelectedRedeemCoin(coin)
  }

  const errorMap = [
    {
      errorCheck: (err) => {
        return err.name === 'EthAppPleaseEnableContractData'
      },
      friendlyMessage: fbt(
        'Contract data not enabled. Go to Ethereum app Settings and set "Contract Data" to "Allowed"',
        'Enable contract data'
      ),
    },
    {
      errorCheck: (err) => {
        return err.message.includes(
          'Failed to sign with Ledger device: U2F DEVICE_INELIGIBL'
        )
      },
      friendlyMessage: fbt(
        'Can not detect ledger device. Please make sure your Ledger is unlocked and Ethereum App is opened.',
        'See ledger connected'
      ),
    },
  ]

  const onMintingError = (error) => {
    if (errorMap.filter((eMap) => eMap.errorCheck(error)).length > 0) {
      setBuyErrorToDisplay(error)
    }
  }

  const swapMetadata = () => {
    const coinGiven = swapMode === 'mint' ? selectedBuyCoin : 'ousd'
    const coinReceived = swapMode === 'mint' ? 'ousd' : selectedRedeemCoin
    const swapAmount =
      swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount
    const stablecoinUsed =
      swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin
    return {
      coinGiven,
      coinReceived,
      swapAmount,
      stablecoinUsed,
    }
  }

  const onSwapOusd = async () => {
    analytics.track(
      swapMode === 'mint' ? 'On Swap to OUSD' : 'On Swap from OUSD',
      {
        category: 'swap',
        label: swapMetadata.stablecoinUsed,
        value: swapMetadata.swapAmount,
      }
    )

    const metadata = swapMetadata()

    try {
      analytics.track('Before Swap Transaction', {
        category: 'swap',
        label: metadata.stablecoinUsed,
        value: metadata.swapAmount,
      })

      let result, swapAmount, minSwapAmount
      if (selectedSwap.name === 'flipper') {
        ;({ result, swapAmount, minSwapAmount } = await swapFlipper())
      } else if (selectedSwap.name === 'vault') {
        if (swapMode === 'mint') {
          ;({ result, swapAmount, minSwapAmount } = await mintVault())
        } else {
          ;({ result, swapAmount, minSwapAmount } = await redeemVault())
        }
      } else if (selectedSwap.name === 'uniswap') {
        ;({ result, swapAmount, minSwapAmount } = await swapUniswap())
      } else if (selectedSwap.name === 'uniswapV2') {
        ;({ result, swapAmount, minSwapAmount } = await swapUniswapV2())
      } else if (selectedSwap.name === 'sushiswap') {
        ;({ result, swapAmount, minSwapAmount } = await swapSushiSwap())
      } else if (selectedSwap.name === 'curve') {
        ;({ result, swapAmount, minSwapAmount } = await swapCurve())
      }

      storeTransaction(
        result,
        swapMode,
        swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin,
        {
          [swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin]:
            swapMode === 'mint'
              ? selectedBuyCoinAmount
              : selectedRedeemCoinAmount,
          ousd:
            swapMode === 'mint'
              ? selectedRedeemCoinAmount
              : selectedBuyCoinAmount,
        }
      )
      setStoredCoinValuesToZero()
      setSelectedBuyCoinAmount('')
      setSelectedRedeemCoinAmount('')

      const receipt = await rpcProvider.waitForTransaction(result.hash)
      analytics.track('Swap succeeded User source', {
        category: 'swap',
        label: getUserSource(),
        value: metadata.swapAmount,
      })
      analytics.track('Swap succeeded', {
        category: 'swap',
        label: metadata.stablecoinUsed,
        value: metadata.swapAmount,
      })

      if (swapMode === 'mint') {
        ReactPixel.track('InitiateCheckout', {
          value: selectedRedeemCoinAmount,
          currency: 'usd',
        })

        if (typeof twttr !== 'undefined') {
          twttr.conversion.trackPid('o73z1', {
            tw_sale_amount: selectedRedeemCoinAmount,
            tw_order_quantity: 1,
          })
        }
      }
    } catch (e) {
      const metadata = swapMetadata()
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(swapMode, selectedBuyCoin)
        analytics.track('Swap failed', {
          category: 'swap',
          label: e.message,
        })
      } else {
        analytics.track('Swap canceled', {
          category: 'swap',
        })
      }

      onMintingError(e)
      console.error('Error swapping ousd! ', e)
    }
  }

  // TODO: modify this
  const setStoredCoinValuesToZero = () => {
    Object.values(currencies).forEach(
      (c) => (localStorage[c.localStorageSettingKey] = '0')
    )
  }

  return (
    <>
      <div className="swap-homepage d-flex flex-column flex-grow">
        <SettingsDropdown
          setPriceToleranceValue={setPriceToleranceValue}
          priceToleranceValue={priceToleranceValue}
        />
        {buyErrorToDisplay && (
          <ErrorModal
            error={buyErrorToDisplay}
            errorMap={errorMap}
            onClose={() => {
              setBuyErrorToDisplay(false)
            }}
          />
        )}
        <SwapCurrencyPill
          swapMode={swapMode}
          selectedCoin={selectedBuyCoin}
          onAmountChange={async (amount) => {
            setSelectedBuyCoinAmount(amount)
            setSelectedRedeemCoinAmount(amount)
          }}
          coinValue={
            swapMode === 'mint'
              ? selectedBuyCoinAmount
              : selectedRedeemCoinAmount
          }
          onSelectChange={userSelectsBuyCoin}
          topItem
          onErrorChange={setBalanceError}
        />
        <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
        <SwapCurrencyPill
          swapMode={swapMode}
          selectedSwap={selectedSwap}
          swapsLoading={swapEstimations === 'loading'}
          priceToleranceValue={priceToleranceValue}
          selectedCoin={selectedRedeemCoin}
          onSelectChange={userSelectsRedeemCoin}
        />
        <ApproveSwap
          stableCoinToApprove={swapMode === 'mint' ? selectedBuyCoin : 'ousd'}
          needsApproval={needsApproval}
          selectedSwap={selectedSwap}
          swapMetadata={swapMetadata()}
          onSwap={() => onSwapOusd()}
          allowancesLoaded={allowancesLoaded}
          onMintingError={onMintingError}
          balanceError={balanceError}
          swapsLoaded={swapsLoaded}
          swappingGloballyDisabled={swappingGloballyDisabled}
        />
      </div>
      <style jsx>{`
        .swap-homepage {
          margin: 0px -1px -1px -1px;
          border: solid 1px #cdd7e0;
          border-radius: 10px;
          background-color: #fafbfc;
          min-height: 350px;
          padding: 35px 40px 40px 40px;
          position: relative;
        }

        @media (max-width: 799px) {
          .swap-homepage {
            padding: 23px 20px 20px 20px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(withRpcProvider(SwapHomepage))
