import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import ErrorModal from 'components/buySell/ErrorModal'
import { currencies } from 'constants/Contract'
import withRpcProvider from 'hoc/withRpcProvider'
import usePriceTolerance from 'hooks/usePriceTolerance'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import useTokenPrices from 'hooks/useTokenPrices'
import SwapCurrencyPill from 'components/buySell/SwapCurrencyPill'
import PillArrow from 'components/buySell/_PillArrow'
import SettingsDropdown from 'components/buySell/SettingsDropdown'
import ContractsTable from 'components/buySell/ContractsTable'
import useSwapEstimator from 'hooks/useSwapEstimator'
import withIsMobile from 'hoc/withIsMobile'
import ApproveSwap from 'components/buySell/ApproveSwap'
import { formatCurrencyMinMaxDecimals, removeCommas } from '../../utils/math'
import { event } from '../../../lib/gtm'

const lastUserSelectedCoinKey = 'last_user_selected_coin'
const lastSelectedSwapModeKey = 'last_user_selected_swap_mode'

const SwapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const swapEstimationsError = useStoreState(
    ContractStore,
    (s) => s.swapEstimationsError
  )
  const swapsLoaded = swapEstimations && typeof swapEstimations === 'object'
  const selectedSwap = useStoreState(ContractStore, (s) => s.selectedSwap)
  const { data: prices } = useTokenPrices()

  // mint / redeem
  const [swapMode, setSwapMode] = useState(
    process.browser && localStorage.getItem(lastSelectedSwapModeKey) !== null
      ? localStorage.getItem(lastSelectedSwapModeKey)
      : 'mint'
  )
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)

  const storedSelectedCoin = process.browser
    ? localStorage.getItem(lastUserSelectedCoinKey)
    : 'eth'
  // Just in case inconsistent state happens where selected coin is mix and mode mint, reset selected coin to weth
  const defaultSelectedCoinValue =
    (storedSelectedCoin === 'mix' && swapMode === 'mint'
      ? 'eth'
      : storedSelectedCoin) || 'eth'
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
        lastUserSelectedCoin = 'eth'
        localStorage.setItem(lastUserSelectedCoinKey, 'eth')
      }
      setSelectedBuyCoin(lastUserSelectedCoin || 'eth')
    } else {
      setSelectedBuyCoin('oeth')
      setSelectedRedeemCoin(lastUserSelectedCoin || 'eth')
    }

    // currencies flipped
    localStorage.setItem(lastSelectedSwapModeKey, swapMode)

    if (selectedSwap) {
      const otherCoinAmount =
        Math.floor(selectedSwap.amountReceived * 10 ** 18) / 10 ** 18

      setSelectedBuyCoinAmount(
        Math.floor(otherCoinAmount * 10 ** 18) / 10 ** 18
      )

      setSelectedRedeemCoinAmount(
        Math.floor(selectedSwap.inputAmount * 10 ** 18) / 10 ** 18
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
      selectedSwap,
    }
  }

  const onSwapOeth = async () => {
    const swapTokenUsed =
      swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin
    const swapTokenAmount =
      swapMode === 'mint' ? selectedBuyCoinAmount : selectedRedeemCoinAmount

    event({
      event: 'swap_started',
      swap_token: swapTokenUsed,
      swap_amount: swapTokenAmount,
    })

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

      const amountReceived = String(
        metadata?.selectedSwap?.amountReceived || selectedRedeemCoinAmount
      )

      storeTransaction(
        result,
        swapMode,
        swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin,
        {
          [swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin]:
            swapMode === 'mint' ? selectedBuyCoinAmount : amountReceived,
          oeth: swapMode === 'mint' ? amountReceived : selectedBuyCoinAmount,
        }
      )

      setStoredCoinValuesToZero()
      setSelectedBuyCoinAmount('')
      setSelectedRedeemCoinAmount('')

      await rpcProvider.waitForTransaction(result.hash)
      event({
        event: 'swap_complete',
        swap_type: swapMode,
        swap_token: swapTokenUsed,
        swap_amount: swapTokenAmount,
      })
    } catch (e) {
      const metadata = swapMetadata()
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(swapMode, selectedBuyCoin)
        event({
          event: 'swap_failed',
          swap_type: swapMode,
          swap_token: swapTokenUsed,
          swap_amount: swapTokenAmount,
        })
      } else {
        event({
          event: 'swap_rejected',
          swap_type: swapMode,
          swap_token: swapTokenUsed,
          swap_amount: swapTokenAmount,
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
          <div className="swap-wrapper d-flex flex-column flex-grow">
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
              <h2 className="title">{fbt('Swap', 'Swap')}</h2>
              <SettingsDropdown
                setPriceToleranceValue={setPriceToleranceValue}
                priceToleranceValue={priceToleranceValue}
              />
            </div>
            <div className="swap-main">
              <SwapCurrencyPill
                swapMode={swapMode}
                selectedCoin={selectedBuyCoin}
                onAmountChange={async (amount) => {
                  setSelectedBuyCoinAmount(amount)
                  setSelectedRedeemCoinAmount(amount)
                  if (amount > 0) {
                    event({
                      event: 'change_input_amount',
                      change_amount_to: amount,
                    })
                  }
                }}
                coinValue={
                  swapMode === 'mint'
                    ? selectedBuyCoinAmount
                    : selectedRedeemCoinAmount
                }
                onSelectChange={userSelectsBuyCoin}
                topItem
                onErrorChange={setBalanceError}
                tokenConversions={prices}
              />
              <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
              <SwapCurrencyPill
                swapMode={swapMode}
                selectedSwap={selectedSwap}
                swapsLoading={swapEstimations === 'loading'}
                swapsError={swapEstimations === 'error' && swapEstimationsError}
                priceToleranceValue={priceToleranceValue}
                selectedCoin={selectedRedeemCoin}
                onSelectChange={userSelectsRedeemCoin}
                tokenConversions={prices}
              />
            </div>
          </div>
          <ContractsTable />
          <ApproveSwap
            inputAmount={
              swapMode === 'mint'
                ? selectedBuyCoinAmount
                : selectedRedeemCoinAmount
            }
            coinToApprove={swapMode === 'mint' ? selectedBuyCoin : 'oeth'}
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
            .swap-wrapper {
              margin: 16px 0;
              border: solid 1px #141519;
              border-radius: 10px;
              background-color: #1e1f25;
              position: relative;
              overflow: hidden;
            }

            .swap-main {
              display: flex;
              flex-direction: column;
              width: 100%;
              height: 100%;
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
              margin-bottom: 0;
            }

            @media (max-width: 799px) {
              .swap-wrapper {
                padding-top: 16px;
                border-radius: 4px;
              }

              .swap-header {
                padding: 0 16px 16px 16px;
              }
            }

            @media (max-width: 1080px) {
              .swap-left {
                width: 50%;
              }

              .swap-right {
                width: 50%;
              }
            }
          `}</style>
        </>
      )}
    </>
  )
}

export default withIsMobile(withRpcProvider(SwapHomepage))
