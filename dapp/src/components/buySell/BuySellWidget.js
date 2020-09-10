import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'

import { AccountStore } from 'stores/AccountStore'
import { TransactionStore } from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import CoinRow from 'components/buySell/CoinRow'
import SellWidget from 'components/buySell/SellWidget'
import ApproveModal from 'components/buySell/ApproveModal'
import TimelockedButton from 'components/TimelockedButton'
import ApproveCurrencyInProgressModal from 'components/buySell/ApproveCurrencyInProgressModal'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import withRpcProvider from 'hoc/withRpcProvider'

const BuySellWidget = ({
  storeTransaction,
  storeTransactionError,
  displayedOusdBalance,
}) => {
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const pendingMintTransactions = useStoreState(TransactionStore, (s) =>
    s.transactions.filter((tx) => !tx.mined && tx.type === 'mint')
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const ousdExchangeRates = useStoreState(
    AccountStore,
    (s) => s.ousdExchangeRates
  )
  const [displayedOusdToSell, setDisplayedOusdToSell] = useState('')
  const [ousdToSell, setOusdToSell] = useState(0)
  const [sellFormErrors, setSellFormErrors] = useState({})
  const [sellAllActive, setSellAllActive] = useState(false)
  const [tab, setTab] = useState('buy')
  const [resetStableCoins, setResetStableCoins] = useState(false)
  const [daiOusd, setDaiOusd] = useState(0)
  const [usdtOusd, setUsdtOusd] = useState(0)
  const [usdcOusd, setUsdcOusd] = useState(0)
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

  const totalStablecoins =
    parseFloat(balances['dai']) +
    parseFloat(balances['usdt']) +
    parseFloat(balances['usdc'])
  const totalOUSD = daiOusd + usdcOusd + usdtOusd
  const buyFormHasErrors = Object.values(buyFormErrors).length > 0
  const buyFormHasWarnings = Object.values(buyFormWarnings).length > 0

  // check if form should display any errors
  useEffect(() => {
    const newFormErrors = {}
    if (parseFloat(dai) > parseFloat(balances['dai'])) {
      newFormErrors.dai = 'not_have_enough'
    }
    if (parseFloat(usdt) > parseFloat(balances['usdt'])) {
      newFormErrors.usdt = 'not_have_enough'
    }
    if (parseFloat(usdc) > parseFloat(balances['usdc'])) {
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

  const onMintOusd = async () => {
    const mintedCoins = []
    try {
      const mintAddresses = []
      const mintAmounts = []

      if (usdt > 0) {
        mintAddresses.push(usdtContract.address)
        mintAmounts.push(
          ethers.utils.parseUnits(
            usdt.toString(),
            await usdtContract.decimals()
          )
        )
        mintedCoins.push('usdt')
      }
      if (usdc > 0) {
        mintAddresses.push(usdcContract.address)
        mintAmounts.push(
          ethers.utils.parseUnits(
            usdc.toString(),
            await usdcContract.decimals()
          )
        )
        mintedCoins.push('usdc')
      }
      if (dai > 0) {
        mintAddresses.push(daiContract.address)
        mintAmounts.push(
          ethers.utils.parseUnits(dai.toString(), await daiContract.decimals())
        )
        mintedCoins.push('dai')
      }

      const result = await vaultContract.mintMultiple(
        mintAddresses,
        mintAmounts
      )
      onResetStableCoins()
      storeTransaction(result, `mint`, mintedCoins.join(','), {
        usdt,
        dai,
        usdc,
      })

      setStoredCoinValuesToZero()
    } catch (e) {
      await storeTransactionError(`mint`, mintedCoins.join(','))
      console.error('Error minting ousd! ', e)
    }
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
      await onMintOusd()
    }
  }

  return (
    <>
      <div className="buy-sell-widget d-flex flex-column flex-grow">
        {/* If approve modal is not shown and transactions are pending show
          the pending approval transactions modal */}
        {!showApproveModal && <ApproveCurrencyInProgressModal />}
        {showApproveModal && (
          <ApproveModal
            currenciesNeedingApproval={currenciesNeedingApproval}
            onClose={(e) => {
              e.preventDefault()
              setShowApproveModal(false)
            }}
            onFinalize={async () => {
              await onMintOusd()
              setShowApproveModal(false)
            }}
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
        {tab === 'buy' && !totalStablecoins && (
          <div className="no-coins flex-grow d-flex flex-column align-items-center justify-content-center">
            <div className="d-flex logos">
              <img src="/images/usdt-icon.svg" alt="USDT logo" />
              <img src="/images/dai-icon.svg" alt="DAI logo" />
              <img src="/images/usdc-icon.svg" alt="USDC logo" />
            </div>
            <h2>{fbt('You have no stablecoins', 'You have no stablecoins')}</h2>
            <p>
              {fbt(
                'Get USDT, DAI, or USDC to buy OUSD.',
                'Get USDT, DAI, or USDC to buy OUSD.'
              )}
            </p>
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
          </div>
        )}
        {tab === 'buy' && !!totalStablecoins && (
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
              exchangeRate={ousdExchangeRates['usdt']}
              onCoinChange={setUsdt}
              reset={resetStableCoins}
            />
            <CoinRow
              coin="dai"
              formError={buyFormErrors['dai']}
              formWarning={buyFormWarnings['dai']}
              onOusdChange={setDaiOusd}
              exchangeRate={ousdExchangeRates['dai']}
              onCoinChange={setDai}
              reset={resetStableCoins}
            />
            <CoinRow
              coin="usdc"
              formError={buyFormErrors['usdc']}
              formWarning={buyFormWarnings['usdc']}
              onOusdChange={setUsdcOusd}
              exchangeRate={ousdExchangeRates['usdc']}
              onCoinChange={setUsdc}
              reset={resetStableCoins}
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
                  <div>{fbt('Purchase amount', 'Purchase amount')}</div>

                  <a
                    className="ml-2"
                    onClick={(e) => {
                      e.preventDefault()
                    }}
                  >
                    <img
                      className="question-icon"
                      src="/images/question-icon.svg"
                      alt="Help icon"
                    />
                  </a>
                </div>
                <div className="value ml-auto">
                  {formatCurrency(totalOUSD, 2)}
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
              <TimelockedButton
                disabled={buyFormHasErrors || !totalOUSD}
                className="btn-blue"
                onClick={onBuyNow}
                text={fbt('Buy now', 'Buy now')}
              />
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
            displayedOusdBalance={displayedOusdBalance}
            storeTransaction={storeTransaction}
            storeTransactionError={storeTransactionError}
            toSellTab={() => {
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
          min-height: 470px;
          padding: 25px 40px 40px 40px;
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
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(BuySellWidget)
