import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { ethers } from 'ethers'
import _get from 'lodash/get'

import withIsMobile from 'hoc/withIsMobile'
import withRpcProvider from 'hoc/withRpcProvider'
import { formatCurrency } from 'utils/math'
import CoinWithdrawBox from 'components/buySell/CoinWithdrawBox'
import BuySellModal from 'components/buySell/BuySellModal'
import ContractStore from 'stores/ContractStore'
import YieldStore from 'stores/YieldStore'
import AccountStore from 'stores/AccountStore'
import AnimatedOusdStore from 'stores/AnimatedOusdStore'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import { isMobileMetaMask } from 'utils/device'
import { getUserSource } from 'utils/user'
import Dropdown from 'components/Dropdown'
import usePriceTolerance from 'hooks/usePriceTolerance'

import analytics from 'utils/analytics'

const SellWidget = ({
  isMobile,
  rpcProvider,
  ousdToSell,
  setOusdToSell,
  displayedOusdToSell,
  setDisplayedOusdToSell,
  sellFormErrors,
  setSellFormErrors,
  sellAllActive,
  setSellAllActive,
  storeTransaction,
  storeTransactionError,
  toBuyTab,
  sellWidgetCoinSplit,
  setSellWidgetCoinSplit,
  sellWidgetIsCalculating,
  setSellWidgetIsCalculating,
  sellWidgetState,
  setSellWidgetState,
  sellWidgetSplitsInterval,
  setSellWidgetSplitsInterval,
}) => {
  const redeemFee = useStoreState(YieldStore, (s) => s.redeemFee)
  const sellFormHasErrors = Object.values(sellFormErrors).length > 0
  const ousdToSellNumber = parseFloat(ousdToSell) || 0
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const [priceToleranceOpen, setPriceToleranceOpen] = useState(false)
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const animatedOusdBalanceLoaded = typeof animatedOusdBalance === 'number'

  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const ousdExchangeRates = useStoreState(
    ContractStore,
    (s) => s.ousdExchangeRates
  )
  const latestCalculateSplits = useRef(null)
  const {
    vault: vaultContract,
    usdt: usdtContract,
    dai: daiContract,
    usdc: usdcContract,
    ousd: ousdContract,
  } = useStoreState(ContractStore, (s) => s.contracts || {})

  const positiveCoinSplitCurrencies = sellWidgetCoinSplit
    .filter((coinSplit) => parseFloat(coinSplit.amount) > 0)
    .map((coinSplit) => coinSplit.coin)

  const {
    setPriceToleranceValue,
    priceToleranceValue,
    dropdownToleranceOptions,
  } = usePriceTolerance('redeem')

  const stableCoinSplitsSum = sellWidgetCoinSplit
    .map((split) => parseFloat(split.amount))
    .reduce((a, b) => a + b, 0)

  const exitFee = ousdToSellNumber * redeemFee
  const exchangeRateLoss = ousdToSellNumber - stableCoinSplitsSum - exitFee
  const expectedStablecoins = stableCoinSplitsSum
  const minStableCoinsReceived =
    priceToleranceValue && ousdToSellNumber
      ? expectedStablecoins - (expectedStablecoins * priceToleranceValue) / 100
      : 0

  useEffect(() => {
    if (animatedOusdBalanceLoaded) {
      // toggle should set values that stay even when it is turned off
      if (sellAllActive) {
        setOusdToSellValue(animatedOusdBalance.toString())
      }
    }
  }, [animatedOusdBalance])

  useEffect(() => {
    if (sellWidgetSplitsInterval) {
      clearInterval(sellWidgetSplitsInterval)
    }

    if (sellAllActive && animatedOusdBalanceLoaded) {
      calculateSplits(animatedOusdBalance)
      setSellWidgetSplitsInterval(
        setInterval(() => {
          /* Call this every so often so every X seconds the values are correct.
           * But not too often since that would result in too many contract calls.
           */
          calculateSplits(animatedOusdBalance)
        }, 6000)
      )
    }
  }, [sellAllActive])

  useEffect(() => {
    if (animatedOusdBalanceLoaded) {
      const newFormErrors = {}

      if (parseFloat(ousdToSell) > parseFloat(animatedOusdBalance)) {
        newFormErrors.ousd = 'not_have_enough'
      }

      setSellFormErrors(newFormErrors)
    }
  }, [ousdToSell])

  const setOusdToSellValue = (value) => {
    const notNullValue = parseFloat(value) < 0 ? '0' : value || '0'
    const valueNoCommas = notNullValue.replace(/,/g, '')
    setOusdToSell(valueNoCommas)
    setDisplayedOusdToSell(value)
    // can not include the `calculateSplits` call here because if would be too many contract calls
  }

  /* Mobile MetaMask app has this bug where it doesn't throw an exception on contract
   * call when user rejects the transaction. Interestingly if you quit and re-enter
   * the app after you reject the transaction the correct error with "user rejected..."
   * message is thrown.
   *
   * As a workaround we hide the "waiting for user" modal after 5 seconds no matter what the
   * user does if environment is the mobile metamask.
   */
  const mobileMetaMaskHack = () => {
    if (isMobileMetaMask()) {
      setTimeout(() => {
        setSellWidgetState('redeem now')
      }, 5000)
    }
  }

  const onSellNow = async (e) => {
    analytics.track('Sell now clicked')
    const returnedCoins = positiveCoinSplitCurrencies.join(',')

    const onSellFailure = (amount) => {
      analytics.track('Redeem tx failed', { amount })
    }
    const onSellSuccess = (amount) => {
      analytics.track('Redeem tx succeeded', {
        amount,
        // we already store utm_source as user property. This is for easier analytics
        utm_source: getUserSource(),
      })
      setOusdToSellValue('')
      setSellWidgetCoinSplit([])
    }

    const ousdToSellNumber = parseFloat(ousdToSell)
    const ousdBalanceNumber = parseFloat(ousdBalance)
    /* User might toggle the sellAll button or manually input the OUSD value that is slightly above their
     * wallet ballance, but lower than the animated value. Since we don't trigger form errors when the
     * value is smaller than the animated value, we instead call redeemAll in place of redeem
     * to avoid the error where the contract receives a slighlty higher OUSD amount than is user's balance
     * (even in cases when the sellAll button is not toggled).
     */
    const forceSellAll =
      ousdToSellNumber >= ousdBalanceNumber &&
      animatedOusdBalanceLoaded &&
      ousdToSellNumber <= animatedOusdBalance

    const coinData = Object.assign(
      {},
      ...sellWidgetCoinSplit.map((coinObj) => {
        return { [coinObj.coin]: coinObj.amount }
      })
    )
    coinData.ousd = ousdToSell

    const redeemAmount = ethers.utils.parseUnits(
      ousdToSell.toString(),
      await ousdContract.decimals()
    )
    const percentGasLimitBuffer = 0.25
    let gasEstimate, gasLimit, receipt, result

    setSellWidgetState('waiting-user')

    const minStableCoinsReceivedBN = ethers.utils.parseUnits(
      (Math.floor(minStableCoinsReceived * 10000) / 10000).toString(),
      18
    )

    if (sellAllActive || forceSellAll) {
      try {
        mobileMetaMaskHack()
        gasEstimate = (
          await vaultContract.estimateGas.redeemAll(minStableCoinsReceivedBN)
        ).toNumber()
        console.log('Gas estimate: ', gasEstimate)
        gasLimit = parseInt(gasEstimate * (1 + percentGasLimitBuffer))
        console.log('Gas limit: ', gasLimit)
        result = await vaultContract.redeemAll(minStableCoinsReceivedBN, {
          gasLimit,
        })
        storeTransaction(result, `redeem`, returnedCoins, coinData)
        setSellWidgetState('waiting-network')

        receipt = await rpcProvider.waitForTransaction(result.hash)
        onSellSuccess(ousdToSell)
      } catch (e) {
        // 4001 code happens when a user rejects the transaction
        if (e.code !== 4001) {
          storeTransactionError(`redeem`, returnedCoins, coinData)
          onSellFailure(ousdToSell)
        }
        console.error('Error selling all OUSD: ', e)
        onSellFailure(ousdToSell)
      }
    } else {
      try {
        mobileMetaMaskHack()
        gasEstimate = (
          await vaultContract.estimateGas.redeem(
            redeemAmount,
            minStableCoinsReceivedBN
          )
        ).toNumber()
        console.log('Gas estimate: ', gasEstimate)
        gasLimit = parseInt(gasEstimate * (1 + percentGasLimitBuffer))
        console.log('Gas limit: ', gasLimit)
        result = await vaultContract.redeem(
          redeemAmount,
          minStableCoinsReceivedBN,
          { gasLimit }
        )
        storeTransaction(result, `redeem`, returnedCoins, coinData)
        setSellWidgetState('waiting-network')

        receipt = await rpcProvider.waitForTransaction(result.hash)
        onSellSuccess(ousdToSell)
      } catch (e) {
        // 4001 code happens when a user rejects the transaction
        if (e.code !== 4001) {
          storeTransactionError(`redeem`, returnedCoins, coinData)
          onSellFailure(ousdToSell)
        }
        console.error('Error selling OUSD: ', e)
      }
    }
    setSellWidgetState('redeem now')
  }

  let calculateItTimeout
  const calculateSplits = async (sellAmount) => {
    const calculateIt = async (calculateSplitsTime) => {
      try {
        const assetAmounts = await vaultContract.calculateRedeemOutputs(
          ethers.utils.parseUnits(
            sellAmount.toString(),
            await ousdContract.decimals()
          )
        )

        const assets = await Promise.all(
          (await vaultContract.getAllAssets()).map(async (address, index) => {
            const contracts = ContractStore.currentState.contracts
            const coin = Object.keys(contracts).find(
              (coin) =>
                contracts[coin] &&
                contracts[coin].address.toLowerCase() === address.toLowerCase()
            )

            const amount = ethers.utils.formatUnits(
              assetAmounts[index].toString(),
              await contracts[coin].decimals()
            )

            return {
              coin,
              amount,
            }
          })
        )

        if (calculateSplitsTime === latestCalculateSplits.current) {
          setSellWidgetCoinSplit(assets)
        }
      } catch (err) {
        console.error(err)
        if (calculateSplitsTime === latestCalculateSplits.current) {
          setSellWidgetCoinSplit([])
        }
      }

      if (calculateSplitsTime === latestCalculateSplits.current) {
        setSellWidgetIsCalculating(false)
      }
    }

    if (calculateItTimeout) {
      clearTimeout(calculateItTimeout)
    }

    calculateItTimeout = setTimeout(async () => {
      const currentTime = Date.now()
      setSellWidgetIsCalculating(true)
      /* Need this to act as a mutable object, so no matter the order in which the multiple
       * "calculateIt" calls execute / update state. Only the one invoked the last is allowed
       * to update state.
       */
      latestCalculateSplits.current = currentTime
      await calculateIt(currentTime)
    }, 250)
  }

  const sortSplitCurrencies = (currencies) => {
    return currencies.sort((coin) => {
      switch (coin) {
        case 'usdt':
          return -1
        case 'dai':
          return 0
        case 'usdc':
          return 1
      }
    })
  }

  /* When floating point differences become really small the js switches to an "e" notation.
   * Switch to that format produces weird behaviour that makes the remaining balance animation
   * disolay erratically. So we round to a 6th decimal place to avoid this behaviour.
   */
  const multiplier = Math.pow(10, 6)
  const remainingBalance =
    (Math.floor((animatedOusdBalance || 0) * multiplier) -
      Math.floor(ousdToSellNumber * multiplier)) /
    multiplier

  return (
    <>
      {sellWidgetState !== 'redeem now' && (
        <BuySellModal
          content={
            <>
              {sellWidgetState === 'waiting-user' && (
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
              )}
              {sellWidgetState === 'waiting-network' && (
                <>{fbt('Selling OUSD...', 'Selling OUSD...')}</>
              )}
            </>
          }
        />
      )}
      {parseFloat(ousdBalance) > 0 && (
        <div className="sell-table">
          <div className="header d-flex">
            <div className="ml-auto text-right pr-2">
              {fbt('Remaining Balance', 'Remaining Balance')}
            </div>
            <div className="weight-normal">
              {formatCurrency(Math.max(0, remainingBalance), 2)} OUSD
            </div>
          </div>
          <div className="d-flex flex-column mb-3">
            <div
              className={`ousd-estimation d-flex align-items-center justify-content-start ${
                Object.values(sellFormErrors).length > 0 ? 'error' : ''
              }`}
            >
              <div className="amount-redeemed col-6 d-flex align-items-center justify-content-start grey-text big">
                <span className="d-none d-md-flex">
                  {fbt('Amount being redeemed', 'Amount being redeemed')}
                </span>
                <span className="d-flex d-md-none">
                  {fbt('Amount redeemed', 'Amount redeemed')}
                </span>
              </div>
              {/* This extra div needed for error border style*/}
              <div className="estimation-input-holder col-6 d-flex align-items-center">
                <button
                  className={`sell-all-button ${sellAllActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    analytics.track('Sell all clicked')
                    setSellAllActive(!sellAllActive)
                    setOusdToSellValue(ousdBalance)
                  }}
                >
                  {fbt('Max', 'Max')}
                </button>
                <input
                  type="float"
                  placeholder="0.00"
                  className="ml-auto text-right"
                  value={
                    sellAllActive
                      ? formatCurrency(animatedOusdBalance || 0, 6)
                      : displayedOusdToSell
                  }
                  onChange={(e) => {
                    const value = e.target.value
                    const notNullValue =
                      parseFloat(value) < 0 ? '0' : value || '0'
                    setOusdToSellValue(value)
                    calculateSplits(notNullValue.replace(/,/g, ''))
                  }}
                  onBlur={(e) => {
                    setDisplayedOusdToSell(
                      ousdToSell !== 0 ? formatCurrency(ousdToSell, 6) : ''
                    )
                  }}
                  onFocus={(e) => {
                    if (!ousdToSell) {
                      setDisplayedOusdToSell('')
                    }
                    if (sellAllActive) {
                      setSellAllActive(false)
                    }
                  }}
                />
              </div>
            </div>
            <div className="redeem-calc-holder d-flex flex-column w-100">
              <div className="d-flex justify-content-between mb-2">
                <div className="grey-text d-flex">
                  {fbt('Exit fee', 'Exit fee')}
                  <DisclaimerTooltip
                    smallIcon
                    className="ml-2"
                    text={fbt(
                      'An exit fee of ' +
                        fbt.param(
                          'exit_fee',
                          formatCurrency(redeemFee * 100, 1)
                        ) +
                        '% is charged upon redemption. This fee serves as a security feature to prevent attackers from exploiting inaccurate prices. It is distributed as additional yield to other holders of OUSD.',
                      'An exit fee of [configurable_value] is charged upon redemption. This fee serves as a security feature to prevent attackers from exploiting inaccurate prices. It is distributed as additional yield to other holders of OUSD.'
                    )}
                  />
                </div>
                <div className="grey-text text-normal">
                  {formatCurrency(exitFee, 2)}
                </div>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <div className="grey-text d-flex">
                  {fbt('Exchange rate loss', 'Exchange rate loss')}
                  <DisclaimerTooltip
                    smallIcon
                    className="ml-2"
                    text={fbt(
                      'OUSD/stablecoin exchange rates fluctuate regularly and may change before your transaction is confirmed. As a security precaution, the maximum allowable OUSD/stablecoin redeem rate is 1.00, which means that users will never receive more than one stablecoin for each unit of OUSD.',
                      'OUSD/stablecoin exchange rates fluctuate regularly and may change before your transaction is confirmed. As a security precaution, the maximum allowable OUSD/stablecoin redeem rate is 1.00, which means that users will never receive more than one stablecoin for each unit of OUSD.'
                    )}
                  />
                </div>
                <div className="grey-text text-normal">
                  {formatCurrency(exchangeRateLoss, 2)}
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-between mb-1">
                <div className="grey-text d-flex">
                  {fbt('Estimated stablecoins', 'Estimated stablecoins')}
                  <DisclaimerTooltip
                    smallIcon
                    className="ml-2"
                    text={fbt(
                      "You will receive a mix of stablecoins upon redemption. Amounts are calculated based on exchange rates and the OUSD vault's current holdings.",
                      "You will receive a mix of stablecoins upon redemption. Amounts are calculated based on exchange rates and the OUSD vault's current holdings."
                    )}
                  />
                </div>
                <div className="total-text">
                  {formatCurrency(expectedStablecoins, 2)}
                </div>
              </div>
            </div>
          </div>
          {ousdToSellNumber === 0 && (
            <div className="withdraw-no-ousd-banner d-flex flex-column justify-content-center align-items-center">
              <div className="title">
                {fbt('Enter OUSD amount to redeem', 'Enter Ousd to redeem')}
              </div>
              <div>
                {fbt(
                  'We will show you a preview of the stablecoins you will receive. You can also sell OUSD on Uniswap or another exchange if you prefer to receive a specific stablecoin.',
                  'Enter Ousd to sell text'
                )}
              </div>
            </div>
          )}
          {ousdToSellNumber > 0 && (
            <>
              <div className="d-flex flex-column flex-md-row calculated-holder">
                <div className="grey-text">
                  {fbt('Stablecoin Mix', 'Stablecoin Mix')}
                </div>
                <DisclaimerTooltip
                  id="howSaleCalculatedPopover"
                  text={fbt(
                    'The vault is designed to maintain a consistent ratio of various stablecoins. When OUSD is redeemed, stablecoins are withdrawn according to this ratio. This is a security feature that protects the vault in the event that one stablecoin loses its peg to the dollar. If you have a strong preference, consider selling OUSD on Uniswap or another exchange.',
                    'The vault is designed to maintain a consistent ratio of various stablecoins. When OUSD is redeemed, stablecoins are withdrawn according to this ratio. This is a security feature that protects the vault in the event that one stablecoin loses its peg to the dollar. If you have a strong preference, consider selling OUSD on Uniswap or another exchange.'
                  )}
                >
                  <div
                    className="calculated-toggler"
                    aria-expanded="false"
                    aria-label="Toggle how it is calculated popover"
                  >
                    {fbt(
                      "Why can't I choose which stablecoins to receive?",
                      'WhyCantChoseStableCoins'
                    )}
                  </div>
                </DisclaimerTooltip>
              </div>
              <div className="withdraw-section d-flex justify-content-center">
                {sortSplitCurrencies(positiveCoinSplitCurrencies).map(
                  (coin, i) => {
                    const currenciesLength = positiveCoinSplitCurrencies.length
                    const obj =
                      sellWidgetCoinSplit &&
                      sellWidgetCoinSplit.filter(
                        (coinSplit) => coinSplit.coin === coin
                      )
                    const amount = _get(obj, '0.amount', '')
                    const classNames = []

                    if (i == 0) {
                      classNames.push('left')
                    }
                    if (i === currenciesLength - 1) {
                      classNames.push('right')
                    }
                    if (i > 0) {
                      classNames.push('no-left-border')
                    }

                    return (
                      <CoinWithdrawBox
                        key={coin}
                        coin={coin}
                        className={classNames.join(' ')}
                        exchangeRate={ousdExchangeRates[coin].redeem}
                        amount={amount}
                        loading={setSellWidgetIsCalculating}
                      />
                    )
                  }
                )}
              </div>
              <div className="d-flex flex-column flex-md-row tolerance-holder grey-text">
                <div className="col-12 col-md-4 border-lg-right d-flex justify-content-between tolerance-select">
                  <div className="d-flex">
                    <div className="mr-2 d-flex align-items-center">
                      {fbt('Price tolerance', 'Price tolerance')}
                    </div>
                    <DisclaimerTooltip
                      className="align-items-center"
                      smallIcon
                      text={fbt(
                        'Much like slippage, exchange rate fluctuations can cause you to receive fewer stablecoins than expected. Price tolerance is the maximum reduction percentage that you are willing to accept. Transactions below this threshold will revert.',
                        'Much like slippage, exchange rate fluctuations can cause you to receive fewer stablecoins than expected. Price tolerance is the maximum reduction percentage that you are willing to accept. Transactions below this threshold will revert.'
                      )}
                    />
                  </div>
                  <Dropdown
                    className="d-flex align-items-center min-h-42"
                    content={
                      <div className="d-flex flex-column dropdown-menu show">
                        {dropdownToleranceOptions.map((toleranceOption) => {
                          return (
                            <div
                              key={toleranceOption}
                              className={`price-tolerance-option ${
                                priceToleranceValue === toleranceOption
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={(e) => {
                                e.preventDefault()
                                setPriceToleranceValue(toleranceOption)
                                setPriceToleranceOpen(false)
                              }}
                            >
                              {toleranceOption}%
                            </div>
                          )
                        })}
                      </div>
                    }
                    open={priceToleranceOpen}
                    onClose={() => setPriceToleranceOpen(false)}
                  >
                    <div
                      className="price-tolerance-selected d-flex"
                      onClick={(e) => {
                        setPriceToleranceOpen(!priceToleranceOpen)
                      }}
                    >
                      <div>
                        {priceToleranceValue
                          ? `${priceToleranceValue}%`
                          : '...'}
                      </div>
                      <div>
                        <img
                          className="tolerance-caret"
                          src="/images/caret-left-grey.svg"
                        />
                      </div>
                    </div>
                  </Dropdown>
                </div>
                <div className="col-12 col-md-8 d-flex justify-content-between tolerance-value">
                  <div className="d-flex min-h-42">
                    <div className="mr-2 d-flex align-items-center">
                      {fbt(
                        'Min. stablecoins received',
                        'Min. stablecoins received'
                      )}
                    </div>
                    <DisclaimerTooltip
                      className="align-items-center"
                      smallIcon
                      text={fbt(
                        'You will receive at least this amount of stablecoins or your transaction will revert. Exchange rates and OUSD vault balances determine exact amounts when your transaction is confirmed.',
                        'You will receive at least this amount of stablecoins or your transaction will revert. Exchange rates and OUSD vault balances determine exact amounts when your transaction is confirmed.'
                      )}
                    />
                  </div>
                  <div className="d-flex align-items-center min-h-42">
                    {formatCurrency(minStableCoinsReceived, 2, true)}
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="actions d-flex flex-md-row flex-column justify-content-center justify-content-md-between">
            <div>
              {Object.values(sellFormErrors).length > 0 && (
                <div className="error-box d-flex align-items-center justify-content-center mb-4 mb-md-0">
                  {fbt(
                    'You don’t have enough ' +
                      fbt.param(
                        'coins',
                        Object.keys(sellFormErrors).join(', ').toUpperCase()
                      ),
                    'You dont have enough stablecoins'
                  )}
                </div>
              )}
            </div>
            <button
              disabled={
                sellFormHasErrors ||
                !(ousdToSellNumber > 0) ||
                // wait for the coins splits to load up before enabling button otherwise transaction in history UI breaks
                !(positiveCoinSplitCurrencies.length > 0) ||
                sellWidgetIsCalculating ||
                sellWidgetState !== 'redeem now'
              }
              className="btn-blue"
              onClick={onSellNow}
            >
              {fbt('Redeem OUSD', 'Redeem OUSD')}
            </button>
          </div>
        </div>
      )}
      {parseFloat(ousdBalance) <= 0 && (
        <div className="no-ousd d-flex flex-column align-items-center justify-content-center">
          <img className="coin" src="/images/ousd-coin.svg" />
          <h2>{fbt('You have no OUSD', 'You have no OUSD')}</h2>
          <a
            className="buy-ousd d-flex align-items-center justify-content-center"
            onClick={(e) => {
              e.preventDefault()
              toBuyTab()
            }}
          >
            {fbt('Mint OUSD', 'Mint OUSD')}
          </a>
        </div>
      )}
      <style jsx>{`
        .no-ousd {
          height: 100%;
          min-height: 400px;
        }

        .no-ousd .coin {
          width: 94px;
          height: 94px;
          margin-bottom: 30px;
        }

        .no-ousd h2 {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-bottom: 45px;
        }

        .buy-ousd {
          height: 50px;
          border-radius: 25px;
          border: solid 1px #1a82ff;
          background-color: #fafbfc;
          padding: 13px 58px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
          cursor: pointer;
        }

        .buy-ousd:hover {
          background-color: #1a82ff12;
        }

        .sell-table .header {
          margin-top: -19px;
          margin-bottom: 20px;
        }

        .withdraw-no-ousd-banner {
          font-size: 12px;
          line-height: 1.42;
          text-align: center;
          color: #8293a4;
          min-height: 175px;
          height: 175px;
          border-radius: 5px;
          background-color: #f2f3f5;
          margin-bottom: 28px;
          padding: 60px;
        }

        .withdraw-no-ousd-banner .title {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: 9px;
        }

        .ousd-estimation {
          height: 50px;
          width: 100%;
          border-radius: 0px 5px 0px 0px;
          border: solid 1px #cdd7e0;
          background-color: white;
        }

        .ousd-estimation input {
          width: 165px;
          height: 40px;
          border: 0px;
          font-size: 18px;
          color: black;
          padding: 8px 0px 8px 0px;
          text-align: left;
        }

        .ousd-estimation .amount-redeemed {
          background-color: #f2f3f5;
          height: 50px;
          border-radius: 5px 0px 0px 0px;
          border: solid 1px #cdd7e0;
          margin: -1px;
        }

        .ousd-estimation input:focus {
          outline: none;
        }

        .estimation-input-holder {
          border-radius: 0px 5px 5px 0px;
          padding: 0px 15px;
          height: 50px;
          flex-grow: 1;
          margin-right: -1px;
        }

        .ousd-estimation.error .estimation-input-holder {
          border: solid 1px #ed2a28;
        }

        .withdraw-section {
          margin-bottom: 20px;
        }

        .remaining-ousd {
          height: 50px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #f2f3f5;
          width: 50%;
          margin-left: 5px;
          margin-right: -5px;
        }

        .ousd-estimation .value {
          font-size: 18px;
          color: black;
          padding: 14px;
        }

        .balance {
          font-size: 12px;
          font-weight: normal;
          text-align: right;
          color: #8293a4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 1rem;
        }

        .header {
          font-size: 12px;
          font-weight: bold;
          color: #8293a4;
          margin-top: 18px;
          margin-bottom: 9px;
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
          min-width: 300px;
        }

        .sell-all-button {
          height: 18px;
          border-radius: 9px;
          background-color: #bbc9da;
          font-size: 12px;
          border: 0px;
          color: white;
          white-space: nowrap;
          padding: 0px 8px;
        }

        .sell-all-button:hover {
          background-color: #bdcadc;
        }

        .sell-all-button.active {
          background-color: #183140;
          color: white;
        }

        .sell-all-button.active:hover {
          background-color: #284150;
          color: white;
        }

        .grey-text {
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          color: #8293a4;
        }

        .grey-text.big {
          font-size: 14px;
        }

        .calculated-holder {
          margin-bottom: 11px;
        }

        .calculated-toggler {
          font-family: Lato;
          font-size: 12px;
          margin-left: 13px;
          color: #1a82ff;
          border: 0px;
          background-color: transparent;
          cursor: pointer;
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        .weight-normal {
          font-weight: normal;
        }

        .redeem-calc-holder {
          padding: 10px 15px;
          border-radius: 0px 0px 5px 5px;
          background-color: #f2f3f5;
          border: solid 1px #cdd7e0;
          border-top: 0px;
        }

        .redeem-calc-holder hr {
          border-top: solid 1px #cdd7e0;
          width: 100%;
          margin-top: 0px;
          margin-bottom: 14px;
        }

        .text-normal {
          text-weight: normal;
        }

        .total-text {
          font-size: 18px;
          font-weight: normal;
          color: black;
        }

        .tolerance-holder {
          border-radius: 5px;
          border: solid 1px #cbd7e1;
          background-color: #f2f3f5;
          min-height: 50px;
          margin-bottom: 20px;
        }

        .price-tolerance-option {
          cursor: pointer;
          text-align: right;
        }

        .price-tolerance-option.selected {
          cursor: auto;
          color: #8293a4;
        }

        .border-lg-right {
          border-right: solid 1px #cdd7e0;
        }

        .price-tolerance-selected {
          cursor: pointer;
          font-weight: normal;
        }

        .tolerance-caret {
          width: 5px;
          height: 7px;
          transform: rotate(270deg);
          margin-left: 6px;
        }

        .dropdown-menu {
          top: 100%;
          min-width: 100px;
        }

        @media (max-width: 799px) {
          .withdraw-section {
            justify-content: space-between;
            margin-bottom: 25px;
          }

          .error-box {
            margin-bottom: 20px;
          }

          .withdraw-no-ousd-banner {
            min-height: 159px;
            height: 159px;
            padding: 30px;
          }

          .ousd-estimation input {
            width: 80%;
            padding: 8px 8px 8px 0px;
          }

          .estimation-input-holder {
            padding: 0px 10px;
          }

          .remaining-ousd {
            width: 40%;
          }

          .sell-table .header {
            margin-top: 18px;
            margin-bottom: 9px;
          }

          .tolerance-select,
          .tolerance-value {
            min-height: 42px;
          }

          .border-lg-right {
            border-right: 0px;
          }

          .calculated-toggler {
            margin-left: 0px;
            margin-top: 3px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(withRpcProvider(SellWidget))
