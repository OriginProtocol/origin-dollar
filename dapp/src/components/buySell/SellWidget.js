import React, { useState, useEffect, useRef } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { ethers } from 'ethers'
import _get from 'lodash/get'

import withRpcProvider from 'hoc/withRpcProvider'
import { formatCurrency } from 'utils/math'
import CoinWithdrawBox from 'components/buySell/CoinWithdrawBox'
import BuySellModal from 'components/buySell/BuySellModal'
import ContractStore from 'stores/ContractStore'
import AccountStore from 'stores/AccountStore'
import AnimatedOusdStore from 'stores/AnimatedOusdStore'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import { isMobileMetaMask } from 'utils/device'
import { getUserSource } from 'utils/user'

import mixpanel from 'utils/mixpanel'

const SellWidget = ({
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
  const sellFormHasErrors = Object.values(sellFormErrors).length > 0
  const ousdToSellNumber = parseFloat(ousdToSell) || 0
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const animatedOusdBalanceLoaded = typeof animatedOusdBalance === 'number'
  const [
    sellWidgetCalculateDropdownOpen,
    setSellWidgetCalculateDropdownOpen,
  ] = useState(false)

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
    mixpanel.track('Sell now clicked')
    const returnedCoins = positiveCoinSplitCurrencies.join(',')

    const onSellFailure = (amount) => {
      mixpanel.track('Redeem tx failed', { amount })
    }
    const onSellSuccess = (amount) => {
      mixpanel.track('Redeem tx succeeded', {
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

    if (sellAllActive || forceSellAll) {
      try {
        mobileMetaMaskHack()
        gasEstimate = (await vaultContract.estimateGas.redeemAll(0)).toNumber()
        console.log('Gas estimate: ', gasEstimate)
        gasLimit = parseInt(gasEstimate * (1 + percentGasLimitBuffer))
        console.log('Gas limit: ', gasLimit)
        result = await vaultContract.redeemAll(0, { gasLimit })
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
          await vaultContract.estimateGas.redeem(redeemAmount, 0)
        ).toNumber()
        console.log('Gas estimate: ', gasEstimate)
        gasLimit = parseInt(gasEstimate * (1 + percentGasLimitBuffer))
        console.log('Gas limit: ', gasLimit)
        result = await vaultContract.redeem(redeemAmount, 0, { gasLimit })
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
      /* Need this to act as a mutable obeject, so no matter the order in which the multiple
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
            <div>{fbt('Stablecoin', 'Stablecoin')}</div>
            <div className="ml-auto text-right pr-3">
              {fbt('Remaining Balance', 'Remaining Balance')}
            </div>
          </div>
          <div className="d-flex estimation-holder">
            <div
              className={`ousd-estimation d-flex align-items-center justify-content-start ${
                Object.values(sellFormErrors).length > 0 ? 'error' : ''
              }`}
            >
              <div className="estimation-image-holder d-flex align-items-center justify-content-center">
                <img
                  src="/images/currency/ousd-token.svg"
                  alt="OUSD token icon"
                />
              </div>
              {/* This extra div needed for error border style*/}
              <div className="estimation-input-holder d-flex align-items-center">
                <input
                  type="float"
                  placeholder="0.00"
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
                <button
                  className={`sell-all-button ${sellAllActive ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    mixpanel.track('Sell all clicked')
                    setSellAllActive(!sellAllActive)
                    setOusdToSellValue(ousdBalance)
                  }}
                >
                  <span className="d-flex d-md-none">{fbt('All', 'All')}</span>
                  <span className="d-none d-md-flex">
                    {fbt('Redeem all', 'Redeem all')}
                  </span>
                </button>
              </div>
            </div>
            <div className="remaining-ousd d-flex align-items-center justify-content-end">
              <div className="balance ml-auto">
                {formatCurrency(Math.max(0, remainingBalance), 6)} OUSD
              </div>
            </div>
          </div>
          <div className="horizontal-break" />
          {ousdToSellNumber === 0 && (
            <div className="withdraw-no-ousd-banner d-flex flex-column justify-content-center align-items-center">
              <div className="title">
                {fbt('Enter OUSD amount to redeem', 'Enter Ousd to redeem')}
              </div>
              <div>
                {fbt(
                  'We will show you a preview of the stablecoins you will receive in exchange. Amount generated will include an exit fee of 0.5%',
                  'Enter Ousd to sell text'
                )}
              </div>
            </div>
          )}
          {ousdToSellNumber > 0 && (
            <>
              <div className="d-flex calculated-holder">
                <div className="grey-text">
                  {fbt('Estimated Stablecoins', 'Estimated Stablecoins')}
                </div>
                <DisclaimerTooltip
                  id="howSaleCalculatedPopover"
                  isOpen={sellWidgetCalculateDropdownOpen}
                  onClose={() => setSellWidgetCalculateDropdownOpen(false)}
                  text={fbt(
                    'You will receive a mix of stablecoins from the underlying vault when you sell OUSD. The amounts are calculated from the current holdings of the pool and exchange rates. A 0.5% exit fee will be charged. You may receive slightly more or less stablecoins than are estimated.',
                    'You will receive a mix of stablecoins from the underlying vault when you sell OUSD. The amounts are calculated from the current holdings of the pool and exchange rates. A 0.5% exit fee will be charged. You may receive slightly more or less stablecoins than are estimated.'
                  )}
                >
                  <button
                    className="calculated-toggler"
                    type="button"
                    aria-expanded="false"
                    aria-label="Toggle how it is calculated popover"
                    onClick={(e) => {
                      setSellWidgetCalculateDropdownOpen(
                        !sellWidgetCalculateDropdownOpen
                      )
                    }}
                  >
                    {fbt('How is this calculated?', 'HowCalculated')}
                  </button>
                </DisclaimerTooltip>
              </div>
              <div className="withdraw-section d-flex justify-content-center">
                {sortSplitCurrencies(positiveCoinSplitCurrencies).map(
                  (coin) => {
                    const obj =
                      sellWidgetCoinSplit &&
                      sellWidgetCoinSplit.filter(
                        (coinSplit) => coinSplit.coin === coin
                      )
                    const amount = _get(obj, '0.amount', '')
                    return (
                      <CoinWithdrawBox
                        key={coin}
                        coin={coin}
                        exchangeRate={ousdExchangeRates[coin].redeem}
                        amount={amount}
                        loading={setSellWidgetIsCalculating}
                      />
                    )
                  }
                )}
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
          margin-top: 18px;
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

        .estimation-holder {
          padding: 0px 5px;
        }

        .ousd-estimation {
          height: 50px;
          width: 50%;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: white;
          margin-right: 5px;
          margin-left: -5px;
        }

        .ousd-estimation input {
          width: 125px;
          height: 40px;
          border: 0px;
          font-size: 18px;
          color: black;
          padding: 8px 15px 8px 0px;
          text-align: left;
        }

        .ousd-estimation .estimation-image-holder {
          background-color: #f2f3f5;
          width: 70px;
          height: 50px;
          border-radius: 5px 0px 0px 5px;
          border: solid 1px #cdd7e0;
          margin: -1px;
        }

        .ousd-estimation .estimation-image-holder img {
          width: 30px;
          height: 30px;
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
          margin-left: -10px;
          margin-right: -10px;
          margin-bottom: 28px;
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

        .header > :first-of-type {
          width: 190px;
        }

        .header > :last-of-type {
          margin-left: 10px;
          width: 350px;
        }

        .horizontal-break {
          width: 100%;
          height: 1px;
          background-color: #dde5ec;
          margin-top: 20px;
          margin-bottom: 20px;
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

        .sell-all-button {
          height: 18px;
          border-radius: 9px;
          background-color: #f2f3f5;
          font-size: 12px;
          border: 0px;
          color: #8293a4;
          white-space: nowrap;
          padding: 0px 6px;
        }

        .sell-all-button:hover {
          background-color: #e2e3e5;
          color: #728394;
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
        }

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        @media (max-width: 799px) {
          .withdraw-section {
            margin-left: -5px;
            margin-right: -5px;
            justify-content: space-between;
            margin-bottom: 33px;
          }

          .error-box {
            margin-bottom: 20px;
          }

          .withdraw-no-ousd-banner {
            min-height: 159px;
            height: 159px;
            padding: 30px;
          }

          .ousd-estimation .estimation-image-holder {
            min-width: 40px;
          }

          .ousd-estimation .estimation-image-holder img {
            width: 25px;
            height: 25px;
          }

          .ousd-estimation input {
            width: 80%;
            padding: 8px 8px 8px 0px;
          }

          .estimation-input-holder {
            padding: 0px 10px;
          }

          .ousd-estimation {
            width: 60%;
          }

          .remaining-ousd {
            width: 40%;
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(SellWidget)
