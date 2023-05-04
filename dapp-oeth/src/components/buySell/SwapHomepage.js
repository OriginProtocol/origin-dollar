import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import ErrorModal from 'components/buySell/ErrorModal'
import { currencies } from 'constants/Contract'
import withRpcProvider from 'hoc/withRpcProvider'
import usePriceTolerance from 'hooks/usePriceTolerance'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import useEthPrice from 'hooks/useEthPrice'
import SwapCurrencyPill from 'components/buySell/SwapCurrencyPill'
import PillArrow from 'components/buySell/_PillArrow'
import SettingsDropdown from 'components/buySell/SettingsDropdown'
import ContractsTable from 'components/buySell/ContractsTable'
import useSwapEstimator from 'hooks/useSwapEstimator'
import withIsMobile from 'hoc/withIsMobile'
import ApproveSwap from 'components/buySell/ApproveSwap'
import analytics from 'utils/analytics'
import { formatCurrencyMinMaxDecimals, removeCommas } from '../../utils/math'

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
  const ethPrice = useEthPrice()

  // mint / redeem
  const [swapMode, setSwapMode] = useState(
    process.browser && localStorage.getItem(lastSelectedSwapModeKey) !== null
      ? localStorage.getItem(lastSelectedSwapModeKey)
      : 'mint'
  )
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)

  const storedSelectedCoin = process.browser
    ? localStorage.getItem(lastUserSelectedCoinKey)
    : 'weth'
  // Just in case inconsistent state happens where selected coin is mix and mode mint, reset selected coin to weth
  const defaultSelectedCoinValue =
    (storedSelectedCoin === 'mix' && swapMode === 'mint'
      ? 'weth'
      : storedSelectedCoin) || 'weth'
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

  const swappingGloballyDisabled =
    process.env.NEXT_PUBLIC_DISABLE_SWAP_BUTTON === 'true'

  const swapParams = (rawCoinAmount, outputAmount) => {
    return {
      swapMode,
      inputAmountRaw: rawCoinAmount,
      outputAmount,
      selectedCoin: swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin,
      priceToleranceValue,
    }
  }

  const round0to18DecimalsNoCommas = (value) => {
    return removeCommas(
      formatCurrencyMinMaxDecimals(value, {
        minDecimals: 0,
        maxDecimals: 18,
        truncate: false,
      })
    )
  }

  useSwapEstimator(
    swapParams(
      // This is added so that onBlur on input field (that sometimes adds decimals) doesn't trigger swap estimation
      round0to18DecimalsNoCommas(
        swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount
      ),
      round0to18DecimalsNoCommas(
        swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount
      )
    )
  )

  const {
    allowancesLoaded,
    needsApproval,
    mintVault,
    redeemVault,
    swapZapper,
    swapCurve,
  } = useCurrencySwapper(
    swapParams(
      swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount,
      selectedSwap ? selectedSwap.amountReceived : 0
    )
  )

  useEffect(() => {
    let lastUserSelectedCoin = process.browser
      ? localStorage.getItem(lastUserSelectedCoinKey)
      : null

    if (swapMode === 'mint') {
      setSelectedRedeemCoin('oeth')
      // TODO: when user comes from 'mix' coin introduce the new empty field
      if (lastUserSelectedCoin === 'mix') {
        lastUserSelectedCoin = 'weth'
        localStorage.setItem(lastUserSelectedCoinKey, 'weth')
      }
      setSelectedBuyCoin(lastUserSelectedCoin || 'weth')
    } else {
      setSelectedBuyCoin('oeth')
      setSelectedRedeemCoin(lastUserSelectedCoin || 'weth')
    }

    // currencies flipped
    localStorage.setItem(lastSelectedSwapModeKey, swapMode)
    if (selectedSwap) {
      const otherCoinAmount =
        Math.floor(selectedSwap.amountReceived * 1000000) / 1000000
      setSelectedBuyCoinAmount(Math.floor(otherCoinAmount * 100) / 100)
      setSelectedRedeemCoinAmount(
        Math.floor(selectedSwap.inputAmount * 100) / 100
      )
    }
  }, [swapMode])

  const userSelectsBuyCoin = (coin) => {
    // treat it as a flip
    if (coin === 'oeth') {
      setSwapMode(swapMode === 'mint' ? 'redeem' : 'mint')
      return
    }
    localStorage.setItem(lastUserSelectedCoinKey, coin)
    setSelectedBuyCoin(coin)
  }

  const userSelectsRedeemCoin = (coin) => {
    // treat it as a flip
    if (coin === 'oeth') {
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
    const coinGiven = swapMode === 'mint' ? selectedBuyCoin : 'oeth'
    const coinReceived = swapMode === 'mint' ? 'oeth' : selectedRedeemCoin
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

  const onSwapOeth = async () => {
    analytics.track(
      swapMode === 'mint' ? 'On Swap to OETH' : 'On Swap from OETH',
      {
        category: 'swap',
        label: swapMetadata.stablecoinUsed,
        value: swapMetadata.swapAmount,
      }
    )

    const metadata = swapMetadata()

    try {
      let result, swapAmount, minSwapAmount

      if (selectedSwap.name === 'vault') {
        if (swapMode === 'mint') {
          ;({ result, swapAmount, minSwapAmount } = await mintVault())
        } else {
          ;({ result, swapAmount, minSwapAmount } = await redeemVault())
        }
      } else if (selectedSwap.name === 'zapper') {
        ;({ result, swapAmount, minSwapAmount } = await swapZapper())
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
          oeth:
            swapMode === 'mint'
              ? selectedRedeemCoinAmount
              : selectedBuyCoinAmount,
        }
      )

      setStoredCoinValuesToZero()
      setSelectedBuyCoinAmount('')
      setSelectedRedeemCoinAmount('')

      await rpcProvider.waitForTransaction(result.hash)

      analytics.track('Swap succeeded', {
        category: 'swap',
        label: metadata.stablecoinUsed,
        value: metadata.swapAmount,
      })
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
      {process.browser && (
        <>
          <div className="swap-routes d-flex flex-column flex-grow">
            {buyErrorToDisplay && (
              <ErrorModal
                error={buyErrorToDisplay}
                errorMap={errorMap}
                onClose={() => {
                  setBuyErrorToDisplay(false)
                }}
              />
            )}
            <div className="swap-header">
              <h2 className="title">{fbt('Swap Routes', 'Swap Routes')}</h2>
              <SettingsDropdown
                setPriceToleranceValue={setPriceToleranceValue}
                priceToleranceValue={priceToleranceValue}
              />
            </div>
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
              ethPrice={ethPrice}
            />
            <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
            <SwapCurrencyPill
              swapMode={swapMode}
              selectedSwap={selectedSwap}
              swapsLoading={swapEstimations === 'loading'}
              priceToleranceValue={priceToleranceValue}
              selectedCoin={selectedRedeemCoin}
              onSelectChange={userSelectsRedeemCoin}
              ethPrice={ethPrice}
            />
          </div>
          <ContractsTable />
          <ApproveSwap
            inputAmount={
              swapMode === 'mint'
                ? selectedBuyCoinAmount
                : selectedRedeemCoinAmount
            }
            stableCoinToApprove={swapMode === 'mint' ? selectedBuyCoin : 'oeth'}
            needsApproval={needsApproval}
            selectedSwap={selectedSwap}
            swapMetadata={swapMetadata()}
            onSwap={() => onSwapOeth()}
            allowancesLoaded={allowancesLoaded}
            onMintingError={onMintingError}
            balanceError={balanceError}
            swapsLoaded={swapsLoaded}
            swappingGloballyDisabled={swappingGloballyDisabled}
          />
          <style jsx>{`
            .swap-routes {
              margin: 0px -1px -1px -1px;
              border: solid 1px #141519;
              border-radius: 10px;
              background-color: #1e1f25;
              min-height: 350px;
              position: relative;
              overflow: hidden;
            }

            .swap-header {
              display: flex;
              align-center: center;
              justify-content: space-between;
              padding: 28px 40px;
              border-bottom: 1px solid #141519;
              width: 100%;
            }

            .title {
              color: #fafbfb;
              font-size: 14px;
            }

            @media (max-width: 799px) {
              .swap-routes {
                padding: 23px 20px 20px 20px;
              }
            }
          `}</style>
        </>
      )}
    </>
  )
}

export default withIsMobile(withRpcProvider(SwapHomepage))
