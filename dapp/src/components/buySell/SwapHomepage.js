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
import BuySellModal from 'components/buySell/BuySellModal'
import SwapCurrencyPill from 'components/buySell/SwapCurrencyPill'
import PillArrow from 'components/buySell/_PillArrow'
import { isMobileMetaMask } from 'utils/device'
import { getUserSource } from 'utils/user'

import analytics from 'utils/analytics'
import { truncateDecimals } from '../../utils/math'

const SwapHomepage = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
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
  const [displayedOusdToSell, setDisplayedOusdToSell] = useState('')
  const [ousdToSell, setOusdToSell] = useState(0)
  const [sellFormErrors, setSellFormErrors] = useState({})
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
  const [swapMode, setSwapMode] = useState('mint')
  const [resetStableCoins, setResetStableCoins] = useState(false)
  const [daiOusd, setDaiOusd] = useState(0)
  const [usdtOusd, setUsdtOusd] = useState(0)
  const [usdcOusd, setUsdcOusd] = useState(0)
  const [daiActive, setDaiActive] = useState(false)
  const [usdtActive, setUsdtActive] = useState(false)
  const [usdcActive, setUsdcActive] = useState(false)
  const [buyErrorToDisplay, setBuyErrorToDisplay] = useState(false)
  const [dai, setDai] = useState(0)
  const [usdt, setUsdt] = useState(0)
  const [usdc, setUsdc] = useState(0)
  const [showApproveModal, _setShowApproveModal] = useState(false)
  const [currenciesNeedingApproval, setCurrenciesNeedingApproval] = useState([])
  const {
    vault: vaultContract,
    usdt: usdtContract,
    dai: daiContract,
    usdc: usdcContract,
    ousd: ousdContract,
  } = useStoreState(ContractStore, (s) => s.contracts || {})
  const [buyFormErrors, setBuyFormErrors] = useState({})
  const [buyFormWarnings, setBuyFormWarnings] = useState({})
  const totalStablecoins =
    parseFloat(balances['dai']) +
    parseFloat(balances['usdt']) +
    parseFloat(balances['usdc'])
  const stableCoinsLoaded =
    typeof balances['dai'] === 'string' &&
    typeof balances['usdt'] === 'string' &&
    typeof balances['usdc'] === 'string'
  const totalOUSD = daiOusd + usdcOusd + usdtOusd
  const {
    setPriceToleranceValue,
    priceToleranceValue,
    dropdownToleranceOptions,
  } = usePriceTolerance('mint')
  const totalOUSDwithTolerance =
    totalOUSD -
    (totalOUSD * (priceToleranceValue ? priceToleranceValue : 0)) / 100
  const buyFormHasErrors = Object.values(buyFormErrors).length > 0
  const buyFormHasWarnings = Object.values(buyFormWarnings).length > 0
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const downsized = [daiOusd, usdtOusd, usdcOusd].some((num) => num > 999999)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const providerNotAutoDetectOUSD = providersNotAutoDetectingOUSD().includes(
    providerName()
  )

  // check if form should display any errors
  useEffect(() => {
    const newFormErrors = {}
    if (parseFloat(dai) > parseFloat(truncateDecimals(balances['dai']))) {
      newFormErrors.dai = 'not_have_enough'
    }
    if (parseFloat(usdt) > parseFloat(truncateDecimals(balances['usdt']))) {
      newFormErrors.usdt = 'not_have_enough'
    }
    if (parseFloat(usdc) > parseFloat(truncateDecimals(balances['usdc']))) {
      newFormErrors.usdc = 'not_have_enough'
    }

    setBuyFormErrors(newFormErrors)
  }, [dai, usdt, usdc, pendingMintTransactions])

  // check if form should display any warnings
  useEffect(() => {
    if (pendingMintTransactions.length > 0) {
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

      const newFormWarnings = {}
      if (
        parseFloat(dai) >
        parseFloat(balances['dai']) - parseFloat(allPendingCoins.dai)
      ) {
        newFormWarnings.dai = 'not_have_enough'
      }
      if (
        parseFloat(usdt) >
        parseFloat(balances['usdt']) - parseFloat(allPendingCoins.usdt)
      ) {
        newFormWarnings.usdt = 'not_have_enough'
      }
      if (
        parseFloat(usdc) >
        parseFloat(balances['usdc']) - parseFloat(allPendingCoins.usdc)
      ) {
        newFormWarnings.usdc = 'not_have_enough'
      }

      setBuyFormWarnings(newFormWarnings)
    } else {
      setBuyFormWarnings({})
    }
  }, [dai, usdt, usdc, pendingMintTransactions])

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

  const mintAmountAnalyticsObject = () => {
    const returnObject = {}
    const coins = [
      {
        name: 'usdt',
        amount: usdt,
        decimals: 6,
      },
      {
        name: 'usdc',
        amount: usdc,
        decimals: 6,
      },
      {
        name: 'dai',
        amount: dai,
        decimals: 18,
      },
    ]

    let total = 0
    coins.forEach((coin) => {
      if (coin.amount > 0) {
        const amount = parseFloat(coin.amount)
        total += amount
        returnObject[coin.name] = amount
      }
    })
    returnObject.totalStablecoins = total
    return returnObject
  }

  const onMintOusd = async (prependStage) => {
    const mintedCoins = []
    setBuyWidgetState(`${prependStage}waiting-user`)
    try {
      const mintAddresses = []
      const mintAmounts = []
      let minMintAmount = ethers.utils.parseUnits(
        totalOUSDwithTolerance.toString(),
        '18'
      )

      const addMintableToken = async (amount, contract, symbol) => {
        if (amount <= 0) {
          // Nothing to add
          return
        }

        mintAddresses.push(contract.address)
        mintAmounts.push(
          ethers.utils
            .parseUnits(amount.toString(), await contract.decimals())
            .toString()
        )

        mintedCoins.push(symbol)
      }

      await addMintableToken(usdt, usdtContract, 'usdt')

      await addMintableToken(usdc, usdcContract, 'usdc')

      await addMintableToken(dai, daiContract, 'dai')

      const absoluteGasLimitBuffer = 20000
      const percentGasLimitBuffer = 0.1

      let gasEstimate, gasLimit, result
      mobileMetaMaskHack(prependStage)

      analytics.track('Mint attempt started', {
        coins: mintedCoins.join(','),
        ...mintAmountAnalyticsObject(),
      })

      if (mintAddresses.length === 1) {
        gasEstimate = (
          await vaultContract.estimateGas.mint(
            mintAddresses[0],
            mintAmounts[0],
            minMintAmount
          )
        ).toNumber()
        gasLimit = parseInt(
          gasEstimate +
            Math.max(
              absoluteGasLimitBuffer,
              gasEstimate * percentGasLimitBuffer
            )
        )
        result = await vaultContract.mint(
          mintAddresses[0],
          mintAmounts[0],
          minMintAmount,
          {
            gasLimit,
          }
        )
      } else {
        gasEstimate = (
          await vaultContract.estimateGas.mintMultiple(
            mintAddresses,
            mintAmounts,
            minMintAmount
          )
        ).toNumber()
        gasLimit = parseInt(
          gasEstimate +
            Math.max(
              absoluteGasLimitBuffer,
              gasEstimate * percentGasLimitBuffer
            )
        )
        result = await vaultContract.mintMultiple(
          mintAddresses,
          mintAmounts,
          minMintAmount,
          {
            gasLimit,
          }
        )
      }

      setBuyWidgetState(`${prependStage}waiting-network`)
      onResetStableCoins()
      storeTransaction(result, `mint`, mintedCoins.join(','), {
        usdt,
        dai,
        usdc,
        ousd: totalOUSD,
      })
      setStoredCoinValuesToZero()

      const receipt = await rpcProvider.waitForTransaction(result.hash)
      analytics.track('Mint tx succeeded', {
        coins: mintedCoins.join(','),
        // we already store utm_source as user property. This is for easier analytics
        utm_source: getUserSource(),
        ousd: totalOUSD,
        minMintAmount,
        priceTolerance: priceToleranceValue,
        ...mintAmountAnalyticsObject(),
      })
      if (localStorage.getItem('addOUSDModalShown') !== 'true') {
        AccountStore.update((s) => {
          s.addOusdModalState = 'waiting'
        })
      }
    } catch (e) {
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        await storeTransactionError(`mint`, mintedCoins.join(','))
        analytics.track('Mint tx failed', {
          coins: mintedCoins.join(','),
          ...mintAmountAnalyticsObject(),
        })
      } else {
        analytics.track('Mint tx canceled', {
          coins: mintedCoins.join(','),
          ...mintAmountAnalyticsObject(),
        })
      }

      onMintingError(e)
      console.error('Error minting ousd! ', e)
    }
    setBuyWidgetState(`buy`)
  }

  // kind of ugly but works
  const onResetStableCoins = () => {
    setResetStableCoins(true)
    setTimeout(() => {
      setResetStableCoins(false)
    }, 100)
  }

  const setStoredCoinValuesToZero = () => {
    Object.values(currencies).forEach(
      (c) => (localStorage[c.localStorageSettingKey] = '0')
    )
  }

  const setShowApproveModal = (show) => {
    _setShowApproveModal(show)
    if (show) {
      analytics.track('Show Approve Modal', mintAmountAnalyticsObject())
    } else {
      analytics.track('Hide Approve Modal')
    }
  }

  const onBuyNow = async (e) => {
    e.preventDefault()
    analytics.track('Mint Now clicked', {
      ...mintAmountAnalyticsObject(),
      location: 'Mint widget',
    })

    const allowancesNotLoaded = ['dai', 'usdt', 'usdc'].filter(
      (coin) => !allowances[coin] || Number.isNaN(parseFloat(allowances[coin]))
    )

    if (allowancesNotLoaded.length > 0) {
      setGeneralErrorReason(
        fbt(
          'Unable to load allowances for ' +
            fbt.param(
              'coin-name(s)',
              allowancesNotLoaded.join(', ').toUpperCase()
            ) +
            '.',
          'Allowance load error'
        )
      )
      return
    }

    const needsApproval = []

    const checkForApproval = (name, selectedAmount) => {
      // float conversion is not ideal, but should be good enough for allowance check
      if (
        selectedAmount > 0 &&
        parseFloat(allowances[name]) < parseFloat(selectedAmount)
      ) {
        needsApproval.push(name)
      }
    }

    checkForApproval('dai', dai)
    checkForApproval('usdt', usdt)
    checkForApproval('usdc', usdc)
    setCurrenciesNeedingApproval(needsApproval)
    if (needsApproval.length > 0) {
      setShowApproveModal(true)
    } else {
      await onMintOusd('')
    }
  }

  let currenciesActive = [
    {
      name: 'usdt',
      active: usdtActive,
      amount: usdt,
    },
    {
      name: 'dai',
      active: daiActive,
      amount: dai,
    },
    {
      name: 'usdc',
      active: usdcActive,
      amount: usdc,
    },
  ]
    .filter((currency) => currency.active && currency.amount > 0)
    .map((currency) => currency.name)

  return (
    <>
      <div className="swap-homepage d-flex flex-column flex-grow">
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
            currenciesNeedingApproval={currenciesNeedingApproval}
            currenciesActive={currenciesActive}
            mintAmountAnalyticsObject={mintAmountAnalyticsObject()}
            onClose={(e) => {
              e.preventDefault()
              // do not close modal if in network or user waiting state
              if ('buy' === buyWidgetState) {
                setShowApproveModal(false)
              }
            }}
            onFinalize={async () => {
              await onMintOusd('modal-')
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
        <SwapCurrencyPill swapMode={swapMode} selectedCoin="dai" topItem />
        <PillArrow swapMode={swapMode} setSwapMode={setSwapMode} />
        <SwapCurrencyPill swapMode={swapMode} selectedCoin="dai" />
      </div>
      <style jsx>{`
        .swap-homepage {
          margin: 0px -1px -1px -1px;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          border-radius: 10px;
          background-color: #fafbfc;
          min-height: 445px;
          padding: 35px 40px 40px 40px;
          position: relative;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(SwapHomepage)
