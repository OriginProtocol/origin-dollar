import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { ethers, BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import TransactionStore from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import ApproveModal from 'components/buySell/ApproveModal'
import AddOUSDModal from 'components/buySell/AddOUSDModal'
import ErrorModal from 'components/buySell/ErrorModal'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import ApproveCurrencyInProgressModal from 'components/buySell/ApproveCurrencyInProgressModal'
import { currencies } from 'constants/Contract'
import { providersNotAutoDetectingOUSD, providerName } from 'utils/web3'
import withRpcProvider from 'hoc/withRpcProvider'
import usePriceTolerance from 'hooks/usePriceTolerance'
import useCurrencySwapper from 'hooks/useCurrencySwapper'
import BuySellModal from 'components/buySell/BuySellModal'
import SwapCurrencyPill from 'components/buySell/SwapCurrencyPill'
import PillArrow from 'components/buySell/_PillArrow'
import SettingsDropdown from 'components/buySell/SettingsDropdown'
import { isMobileMetaMask } from 'utils/device'
import useSwapEstimator from 'hooks/useSwapEstimator'
import withIsMobile from 'hoc/withIsMobile'
import { getUserSource } from 'utils/user'
import usePrevious from 'utils/usePrevious'
import LinkIcon from 'components/buySell/_LinkIcon'
import { find } from 'lodash'

import analytics from 'utils/analytics'
import {
  truncateDecimals,
  formatCurrencyMinMaxDecimals,
  removeCommas,
} from '../../utils/math'

const lastUserSelectedCoinKey = 'last_user_selected_coin'
const lastSelectedSwapModeKey = 'last_user_selected_swap_mode'

const SwapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const pendingMintTransactions = useStoreState(TransactionStore, (s) =>
    s.transactions.filter((tx) => !tx.mined && tx.type === 'mint')
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const ousdExchangeRates = useStoreState(
    ContractStore,
    (s) => s.ousdExchangeRates
  )
  const swapEstimations = useStoreState(ContractStore, (s) => s.swapEstimations)
  const swapsLoaded = swapEstimations && typeof swapEstimations === 'object'
  const selectedSwap = useStoreState(ContractStore, (s) => s.selectedSwap)

  const [displayedOusdToSell, setDisplayedOusdToSell] = useState('')
  const [ousdToSell, setOusdToSell] = useState(0)
  const [sellAllActive, setSellAllActive] = useState(false)
  const [generalErrorReason, setGeneralErrorReason] = useState(null)
  const [sellWidgetIsCalculating, setSellWidgetIsCalculating] = useState(false)
  const [sellWidgetCoinSplit, setSellWidgetCoinSplit] = useState([])
  // redeem now, waiting-user, waiting-network
  const [sellWidgetState, setSellWidgetState] = useState('redeem now')
  const [sellWidgetSplitsInterval, setSellWidgetSplitsInterval] = useState(null)
  // buy/modal-buy, waiting-user/modal-waiting-user, waiting-network/modal-waiting-network
  const [buyWidgetState, setBuyWidgetState] = useState('buy')
  const [priceToleranceOpen, setPriceToleranceOpen] = useState(false)
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
  const [showApproveModal, _setShowApproveModal] = useState(false)
  const {
    vault: vaultContract,
    usdt: usdtContract,
    dai: daiContract,
    usdc: usdcContract,
    ousd: ousdContract,
    flipper,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  const [formError, setFormError] = useState(null)
  const [buyFormWarnings, setBuyFormWarnings] = useState({})
  const totalStablecoins =
    parseFloat(balances['dai']) +
    parseFloat(balances['usdt']) +
    parseFloat(balances['usdc'])
  const stableCoinsLoaded =
    typeof balances['dai'] === 'string' &&
    typeof balances['usdt'] === 'string' &&
    typeof balances['usdc'] === 'string'
  const {
    setPriceToleranceValue,
    priceToleranceValue,
    dropdownToleranceOptions,
  } = usePriceTolerance('mint')

  const swappingGloballyDisabled = process.env.DISABLE_SWAP_BUTTON === 'true'
  const formHasErrors = formError !== null
  const buyFormHasWarnings = buyFormWarnings !== null
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const providerNotAutoDetectOUSD = providersNotAutoDetectingOUSD().includes(
    providerName()
  )

  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
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
        setSelectedBuyCoinAmount(otherCoinAmount)
        setSelectedRedeemCoinAmount(selectedBuyCoinAmount)
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

  // check if form should display any warnings
  useEffect(() => {
    if (pendingMintTransactions.length > 0) {
      if (swapMode === 'mint') {
        const allPendingCoins = pendingMintTransactions
          .map((tx) => tx.data)
          .reduce(
            (a, b) => {
              return {
                dai: parseFloat(a.dai) + parseFloat(b.dai),
                usdt: parseFloat(a.usdt) + parseFloat(b.usdt),
                usdc: parseFloat(a.usdc) + parseFloat(b.usdc),
              }
            },
            {
              dai: 0,
              usdt: 0,
              usdc: 0,
            }
          )

        if (
          parseFloat(selectedBuyCoinAmount) >
          parseFloat(balances[selectedBuyCoin]) -
            parseFloat(allPendingCoins[selectedBuyCoin])
        ) {
          setBuyFormWarnings('not_have_enough')
        } else {
          setBuyFormWarnings(null)
        }
      }
    } else {
      setBuyFormWarnings(null)
    }
  }, [
    swapMode,
    selectedBuyCoin,
    selectedBuyCoinAmount,
    pendingMintTransactions,
  ])

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

  /* Mobile MetaMask app has this bug where it doesn't throw an exception on contract
   * call when user rejects the transaction. Interestingly if you quit and re-enter
   * the app after you reject the transaction the correct error with "user rejected..."
   * message is thrown.
   *
   * As a workaround we hide the "waiting for user" modal after 5 seconds no matter what the
   * user does if environment is the mobile Metamask.
   */
  const mobileMetaMaskHack = (prependStage) => {
    if (isMobileMetaMask()) {
      setTimeout(() => {
        setBuyWidgetState(`${prependStage}buy`)
      }, 5000)
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

  const onSwapOusd = async (prependStage) => {
    setBuyWidgetState(`${prependStage}waiting-user`)
    const metadata = swapMetadata()

    try {
      mobileMetaMaskHack(prependStage)

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
      setBuyWidgetState(`${prependStage}waiting-network`)

      storeTransaction(
        result,
        swapMode,
        swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin,
        {
          [swapMode === 'mint' ? selectedBuyCoin : selectedRedeemCoin]:
            swapMode === 'mint'
              ? selectedBuyCoinAmount
              : selectedRedeemCoinAmount,
          ousd: swapAmount,
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

      if (localStorage.getItem('addOUSDModalShown') !== 'true') {
        AccountStore.update((s) => {
          s.addOusdModalState = 'waiting'
        })
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
    setBuyWidgetState(`buy`)
  }

  // TODO: modify this
  const setStoredCoinValuesToZero = () => {
    Object.values(currencies).forEach(
      (c) => (localStorage[c.localStorageSettingKey] = '0')
    )
  }

  const setShowApproveModal = (contractToApprove) => {
    _setShowApproveModal(contractToApprove)
    const metadata = swapMetadata()

    if (contractToApprove) {
      analytics.track('Show Approve Modal', {
        category: 'swap',
        label: metadata.coinGiven,
        value: parseInt(metadata.swapAmount),
      })
    } else {
      analytics.track('Hide Approve Modal', {
        category: 'swap',
      })
    }
  }

  const onBuyNow = async (e) => {
    const metadata = swapMetadata()

    e.preventDefault()
    analytics.track(
      swapMode === 'mint'
        ? 'On Approve Swap to OUSD'
        : 'On Approve Swap from OUSD',
      {
        category: 'swap',
        label: metadata.stablecoinUsed,
        value: metadata.swapAmount,
      }
    )

    if (!allowancesLoaded) {
      setGeneralErrorReason(
        fbt('Unable to load all allowances', 'Allowance load error')
      )
      console.error('Allowances: ', allowances)
      return
    }

    if (needsApproval) {
      setShowApproveModal(needsApproval)
    } else {
      await onSwapOusd('')
    }
  }

  return (
    <>
      <div className="swap-homepage d-flex flex-column flex-grow">
        <SettingsDropdown
          setPriceToleranceValue={setPriceToleranceValue}
          priceToleranceValue={priceToleranceValue}
          dropdownToleranceOptions={dropdownToleranceOptions}
        />
        {/* If approve modal is not shown and transactions are pending show
          the pending approval transactions modal */}
        {!showApproveModal && <ApproveCurrencyInProgressModal />}
        {addOusdModalState === 'show' && providerNotAutoDetectOUSD && (
          <AddOUSDModal
            onClose={(e) => {
              localStorage.setItem('addOUSDModalShown', 'true')
              AccountStore.update((s) => {
                s.addOusdModalState = 'none'
              })
            }}
          />
        )}
        {showApproveModal && (
          <ApproveModal
            stableCoinToApprove={swapMode === 'mint' ? selectedBuyCoin : 'ousd'}
            swapMode={swapMode}
            swapMetadata={swapMetadata()}
            contractToApprove={showApproveModal}
            onClose={(e) => {
              e.preventDefault()
              // do not close modal if in network or user waiting state
              if ('buy' === buyWidgetState) {
                setShowApproveModal(false)
              }
            }}
            onFinalize={async () => {
              await onSwapOusd('modal-')
              setShowApproveModal(false)
            }}
            buyWidgetState={buyWidgetState}
            onMintingError={onMintingError}
          />
        )}
        {generalErrorReason && (
          <ErrorModal
            reason={generalErrorReason}
            showRefreshButton={true}
            onClose={() => {}}
          />
        )}
        {buyErrorToDisplay && (
          <ErrorModal
            error={buyErrorToDisplay}
            errorMap={errorMap}
            onClose={() => {
              setBuyErrorToDisplay(false)
            }}
          />
        )}
        {buyWidgetState === 'waiting-user' && (
          <BuySellModal
            content={
              <div className="d-flex align-items-center justify-content-center">
                <img
                  className="waiting-icon"
                  src={`/images/${connectorIcon}`}
                />
                {fbt(
                  'Waiting for you to confirm...',
                  'Waiting for you to confirm...'
                )}
              </div>
            }
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
          onErrorChange={setFormError}
        />
        <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
        <SwapCurrencyPill
          swapMode={swapMode}
          selectedSwap={selectedSwap}
          swapsLoaded={swapsLoaded}
          swapsLoading={swapEstimations === 'loading'}
          priceToleranceValue={priceToleranceValue}
          selectedCoin={selectedRedeemCoin}
          onSelectChange={userSelectsRedeemCoin}
        />
        <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="link-detail"
          >
            {/* <span className="pr-2"> */}
            {/*   {fbt( */}
            {/*     'Read about costs associated with OUSD', */}
            {/*     'Read about costs associated with OUSD' */}
            {/*   )} */}
            {/* </span> */}
            {/* <LinkIcon color="1a82ff" /> */}
          </a>
          <button
            //disabled={formHasErrors || buyFormHasWarnings || !totalOUSD}
            className={`btn-blue buy-button mt-2 mt-md-0 w-100`}
            disabled={
              !selectedSwap || formHasErrors || swappingGloballyDisabled
            }
            onClick={onBuyNow}
          >
            {swappingGloballyDisabled &&
              process.env.DISABLE_SWAP_BUTTON_MESSAGE}
            {!swappingGloballyDisabled && fbt('Swap', 'Swap')}
          </button>
        </div>
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

        .link-detail {
          font-size: 12px;
          color: #1a82ff;
        }

        .link-detail:hover {
          color: #3aa2ff;
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        .btn-blue:disabled {
          opacity: 0.4;
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
