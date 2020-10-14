import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers, { BigNumber } from 'ethers'

import AccountStore from 'stores/AccountStore'
import TransactionStore from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import CoinRow from 'components/buySell/CoinRow'
import SellWidget from 'components/buySell/SellWidget'
import ApproveModal from 'components/buySell/ApproveModal'
import AddOUSDModal from 'components/buySell/AddOUSDModal'
import ErrorModal from 'components/buySell/ErrorModal'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import ApproveCurrencyInProgressModal from 'components/buySell/ApproveCurrencyInProgressModal'
import { currencies, gasLimits } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { sleep } from 'utils/utils'
import { providersNotAutoDetectingOUSD, providerName } from 'utils/web3'
import withRpcProvider from 'hoc/withRpcProvider'
import BuySellModal from 'components/buySell/BuySellModal'
import { isMobileMetaMask } from 'utils/device'

import mixpanel from 'utils/mixpanel'
import { truncateDecimals } from '../../utils/math'

const BuySellWidget = ({
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
  const [sellWidgetIsCalculating, setSellWidgetIsCalculating] = useState(false)
  const [sellWidgetCoinSplit, setSellWidgetCoinSplit] = useState([])
  // sell now, waiting-user, waiting-network
  const [sellWidgetState, setSellWidgetState] = useState('sell now')
  const [sellWidgetSplitsInterval, setSellWidgetSplitsInterval] = useState(null)
  // buy/modal-buy, waiting-user/modal-waiting-user, waiting-network/modal-waiting-network
  const [buyWidgetState, setBuyWidgetState] = useState('buy')
  const [tab, setTab] = useState('buy')
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
  const [showApproveModal, setShowApproveModal] = useState(false)
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
  const [calculateDropdownOpen, setCalculateDropdownOpen] = useState(false)
  const totalStablecoins =
    parseFloat(balances['dai']) +
    parseFloat(balances['usdt']) +
    parseFloat(balances['usdc'])
  const stableCoinsLoaded =
    typeof balances['dai'] === 'string' &&
    typeof balances['usdt'] === 'string' &&
    typeof balances['usdc'] === 'string'
  const totalOUSD = daiOusd + usdcOusd + usdtOusd
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

  /* Mobile MetamMsk app has this bug where it doesn't throw an exception on contract
   * call when user rejects the transaction. Interestingly if you quit and re-enter
   * the app after you reject the transaction the correct error with "user rejected..."
   * message is thrown.
   *
   * As a workaround we hide the "waiting for user" modal after 5 seconds no matter what the
   * user does if environment is the mobile metamask.
   */
  const mobileMetaMaskHack = (prependStage) => {
    if (isMobileMetaMask()) {
      setTimeout(() => {
        setBuyWidgetState(`${prependStage}buy`)
      }, 5000)
    }
  }

  const onMintOusd = async (prependStage) => {
    const mintedCoins = []
    setBuyWidgetState(`${prependStage}waiting-user`)
    try {
      const mintAddresses = []
      const mintAmounts = []
      let totalMintAmount = BigNumber.from('0')

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

        // `Vault.autoAllocateThreshold` returns things in 1e18 decimals
        totalMintAmount = totalMintAmount.add(
          ethers.utils.parseUnits(amount.toString(), '18')
        )

        mintedCoins.push(symbol)
      }

      await addMintableToken(usdt, usdtContract, 'usdt')

      await addMintableToken(usdc, usdcContract, 'usdc')

      await addMintableToken(dai, daiContract, 'dai')

      let gasLimit

      const [allocateThreshold, rebaseThreshold] = await Promise.all([
        vaultContract.autoAllocateThreshold(),
        vaultContract.rebaseThreshold(),
      ])

      if (totalMintAmount.gte(allocateThreshold.mul(96).div(100))) {
        // Define gas limit only when the amount is over threshold
        gasLimit = gasLimits.MINT_ALLOCATE_GAS_LIMIT
      } else if (totalMintAmount.gte(rebaseThreshold.mul(96).div(100))) {
        gasLimit = gasLimits.MINT_REBASE_GAS_LIMIT
      } else {
        gasLimit = gasLimits.MINT_BASE_GAS_LIMIT
      }

      if (mintAddresses.length === 2) {
        gasLimit += gasLimits.MINT_2_COIN_ADDITION_GAS_LIMIT
      } else if (mintAddresses.length === 3) {
        gasLimit += gasLimits.MINT_3_COIN_ADDITION_GAS_LIMIT
      }

      let result
      mobileMetaMaskHack(prependStage)
      if (mintAddresses.length === 1) {
        result = await vaultContract.mint(mintAddresses[0], mintAmounts[0], {
          gasLimit,
        })
      } else {
        result = await vaultContract.mintMultiple(mintAddresses, mintAmounts, {
          gasLimit,
        })
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
      mixpanel.track('Mint tx succeeded', {
        coins: mintedCoins.join(','),
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
        mixpanel.track('Mint tx failed', {
          coins: mintedCoins.join(','),
        })
      } else {
        mixpanel.track('Mint tx canceled', {
          coins: mintedCoins.join(','),
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

  const onBuyNow = async (e) => {
    e.preventDefault()

    mixpanel.track('Buy Now clicked')

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
      <div className="buy-sell-widget d-flex flex-column flex-grow">
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
                  'Waiting for you to approve...',
                  'Waiting for you to approve...'
                )}
              </div>
            }
          />
        )}
        <div className="tab-navigation">
          <a
            onClick={(e) => {
              e.preventDefault()
              setTab('buy')
            }}
            className={`${tab === 'buy' ? 'active' : ''}`}
          >
            {fbt('Buy OUSD', 'Buy OUSD')}
          </a>
          <a
            onClick={(e) => {
              e.preventDefault()
              setTab('sell')
            }}
            className={`${tab === 'sell' ? 'active' : ''}`}
          >
            {fbt('Sell OUSD', 'Sell OUSD')}
          </a>
        </div>
        {tab === 'buy' && !parseFloat(totalStablecoins) && (
          <div className="no-coins flex-grow d-flex flex-column align-items-center justify-content-center">
            <div className="d-flex logos">
              <img src="/images/usdt-icon.svg" alt="USDT logo" />
              <img src="/images/dai-icon.svg" alt="DAI logo" />
              <img src="/images/usdc-icon.svg" alt="USDC logo" />
            </div>
            {!stableCoinsLoaded && (
              <h2>{fbt('Loading balances...', 'Loading balances...')}</h2>
            )}
            {stableCoinsLoaded && (
              <>
                <h2>
                  {fbt('You have no stablecoins', 'You have no stablecoins')}
                </h2>
                <p>
                  {fbt(
                    'Get USDT, DAI, or USDC to buy OUSD.',
                    'Get USDT, DAI, or USDC to buy OUSD.'
                  )}
                </p>
              </>
            )}
            {stableCoinsLoaded && (
              <a
                href="https://app.uniswap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-clear-blue btn-lg get-coins"
              >
                <img
                  src="/images/uniswap-icon.svg"
                  alt="Uniswap logo"
                  className="mr-3"
                />
                <div>{fbt('Visit Uniswap', 'Visit Uniswap')}</div>
              </a>
            )}
          </div>
        )}
        {tab === 'buy' && !!parseFloat(totalStablecoins) && (
          <div className="coin-table">
            <div className="header d-flex align-items-end">
              <div>{fbt('Stablecoin', 'Stablecoin')}</div>
              <div className="d-flex d-md-none ml-auto pr-2">
                {fbt('OUSD Amount', 'OUSD Amount')}
              </div>
              <div className="d-md-flex flex-grow d-none">
                <div className="col-3 info d-flex align-items-end justify-content-end text-right balance pr-0">
                  {fbt('Exchange', 'Exchange Rate')}
                </div>
                <div className="col-4 info d-flex align-items-end justify-content-end text-right balance pr-0">
                  {fbt('Balance', 'Balance')}
                </div>
                <div className="col-5 currency d-flex align-items-end justify-content-end text-right">
                  {fbt('OUSD Amount', 'OUSD Amount')}
                </div>
              </div>
            </div>
            <CoinRow
              coin="usdt"
              formError={buyFormErrors['usdt']}
              formWarning={buyFormWarnings['usdt']}
              onOusdChange={setUsdtOusd}
              onActive={setUsdtActive}
              exchangeRate={ousdExchangeRates['usdt'].mint}
              onCoinChange={setUsdt}
              reset={resetStableCoins}
              downsized={downsized}
            />
            <CoinRow
              coin="dai"
              formError={buyFormErrors['dai']}
              formWarning={buyFormWarnings['dai']}
              onOusdChange={setDaiOusd}
              onActive={setDaiActive}
              exchangeRate={ousdExchangeRates['dai'].mint}
              onCoinChange={setDai}
              reset={resetStableCoins}
              downsized={downsized}
            />
            <CoinRow
              coin="usdc"
              formError={buyFormErrors['usdc']}
              formWarning={buyFormWarnings['usdc']}
              onOusdChange={setUsdcOusd}
              onActive={setUsdcActive}
              exchangeRate={ousdExchangeRates['usdc'].mint}
              onCoinChange={setUsdc}
              reset={resetStableCoins}
              downsized={downsized}
            />
            <div className="horizontal-break" />
            <div className="ousd-section d-flex justify-content-between">
              <div className="ousd-estimation d-flex align-items-center justify-content-start w-100">
                <div className="ousd-icon align-items-center justify-content-center d-flex">
                  <img
                    src="/images/currency/ousd-token.svg"
                    alt="OUSD token icon"
                  />
                </div>
                <div className="approx-purchase d-flex align-items-center justify-content-start">
                  <div>{fbt('Estimated purchase', 'Estimated purchase')}</div>
                  <DisclaimerTooltip
                    id="howPurchaseCalculatedPopover"
                    isOpen={calculateDropdownOpen}
                    handleClick={(e) => {
                      e.preventDefault()

                      setCalculateDropdownOpen(!calculateDropdownOpen)
                    }}
                    handleClose={() => setCalculateDropdownOpen(false)}
                    text={fbt(
                      'Your purchase of OUSD depends on stablecoin exchange rates, which may change significantly before your transaction is processed. You may receive more or less OUSD than is shown here.',
                      'Your purchase of OUSD depends on stablecoin exchange rates, which may change significantly before your transaction is processed. You may receive more or less OUSD than is shown here.'
                    )}
                  />
                </div>
                <div className="value ml-auto">
                  {formatCurrency(totalOUSD, 2, true)}
                </div>
              </div>
            </div>
            <div className="actions d-flex flex-column flex-md-row justify-content-md-between">
              <div>
                {buyFormHasErrors ? (
                  <div className="error-box d-flex align-items-center justify-content-center">
                    {fbt(
                      'You don’t have enough ' +
                        fbt.param(
                          'coins',
                          Object.keys(buyFormErrors).join(', ').toUpperCase()
                        ),
                      'You dont have enough stablecoins'
                    )}
                  </div>
                ) : buyFormHasWarnings ? (
                  <div className="warning-box d-flex align-items-center justify-content-center">
                    {fbt(
                      'Some of the needed ' +
                        fbt.param(
                          'coins',
                          Object.keys(buyFormWarnings).join(', ').toUpperCase()
                        ) +
                        ' is in pending transactions.',
                      'Some of needed coins are pending'
                    )}
                  </div>
                ) : null}
              </div>
              <button
                disabled={buyFormHasErrors || !totalOUSD}
                className="btn-blue"
                onClick={onBuyNow}
              >
                {fbt('Buy now', 'Buy now')}
              </button>
            </div>
          </div>
        )}
        {tab === 'sell' && (
          <SellWidget
            ousdToSell={ousdToSell}
            setOusdToSell={setOusdToSell}
            displayedOusdToSell={displayedOusdToSell}
            setDisplayedOusdToSell={setDisplayedOusdToSell}
            sellFormErrors={sellFormErrors}
            setSellFormErrors={setSellFormErrors}
            sellAllActive={sellAllActive}
            setSellAllActive={setSellAllActive}
            storeTransaction={storeTransaction}
            storeTransactionError={storeTransactionError}
            sellWidgetCoinSplit={sellWidgetCoinSplit}
            setSellWidgetCoinSplit={setSellWidgetCoinSplit}
            sellWidgetState={sellWidgetState}
            setSellWidgetState={setSellWidgetState}
            sellWidgetIsCalculating={sellWidgetIsCalculating}
            setSellWidgetIsCalculating={setSellWidgetIsCalculating}
            sellWidgetSplitsInterval={sellWidgetSplitsInterval}
            setSellWidgetSplitsInterval={setSellWidgetSplitsInterval}
            toBuyTab={() => {
              setTab('buy')
            }}
          />
        )}
      </div>
      <style jsx>{`
        .buy-sell-widget {
          margin: 0px -1px -1px -1px;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: #fafbfc;
          min-height: 445px;
          padding: 35px 40px 40px 40px;
          position: relative;
        }

        .buy-sell-widget .header {
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
          margin-top: 18px;
          margin-bottom: 9px;
        }

        .buy-sell-widget .header > :first-of-type {
          width: 190px;
        }

        .buy-sell-widget .header > :last-of-type {
          margin-left: 10px;
          width: 350px;
        }

        .buy-sell-widget .tab-navigation a {
          font-size: 14px;
          font-weight: bold;
          color: #1a82ff;
          padding-bottom: 5px;
          margin-right: 40px;
          cursor: pointer;
        }

        .buy-sell-widget .tab-navigation a.active {
          color: #183140;
          border-bottom: solid 1px #183140;
        }

        .horizontal-break {
          width: 100%;
          height: 1px;
          background-color: #dde5ec;
          margin-top: 20px;
          margin-bottom: 20px;
        }

        .buy-sell-widget .ousd-section {
          margin-bottom: 31px;
        }

        .buy-sell-widget .ousd-section .approx-purchase {
          min-width: 190px;
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
          padding: 14px;
        }

        .buy-sell-widget .ousd-estimation {
          width: 350px;
          height: 50px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          padding: 0;
        }

        .buy-sell-widget .ousd-icon {
          border-right: solid 1px #cdd7e0;
          height: 100%;
          min-width: 70px;
          width: 70px;
        }

        .buy-sell-widget .ousd-estimation .value {
          font-size: 18px;
          color: black;
          padding: 14px;
        }

        .buy-sell-widget .ousd-estimation .balance {
          font-size: 12px;
          color: #8293a4;
        }

        .error-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          background-color: #fff0f0;
          height: 50px;
          min-width: 320px;
        }

        .warning-box {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #eaad00;
          background-color: #fff0c4;
          height: 50px;
          min-width: 320px;
        }

        .no-coins {
          min-height: 400px;
        }

        .no-coins .logos {
          margin-bottom: 20px;
        }

        .no-coins .logos img:not(:first-of-type):not(:last-of-type) {
          margin: 0 -15px;
        }

        .no-coins h2 {
          font-size: 1.375rem;
          margin-bottom: 0;
        }

        .no-coins p {
          font-size: 0.875rem;
          line-height: 1.36;
          color: #8293a4;
          margin: 10px 0 0;
        }

        .no-coins .get-coins {
          font-size: 1.125rem;
          font-weight: bold;
          margin-top: 50px;
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        @media (max-width: 799px) {
          .buy-sell-widget {
            padding: 25px 20px;
          }

          .buy-sell-widget .ousd-section .approx-purchase {
            min-width: 150px;
          }

          .buy-sell-widget .ousd-section {
            margin-bottom: 20px;
          }

          .error-box {
            margin-bottom: 20px;
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(BuySellWidget)
