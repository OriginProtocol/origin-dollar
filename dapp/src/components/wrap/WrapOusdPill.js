import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import {
  formatCurrency,
  formatCurrencyMinMaxDecimals,
  truncateDecimals,
  checkValidInputForCoin,
  removeCommas,
} from 'utils/math'
import { assetRootPath } from 'utils/image'
import { _ } from 'fbt-runtime/lib/fbt'

const CoinImage = ({ small, coin, isSemiTransparent = false }) => {
  const className = `coin-image ${isSemiTransparent ? 'transparent' : ''}`
  return (
    <div className="d-flex align-items-center">
      <img
        className={`${className} ${small ? 'small' : ''}`}
        src={assetRootPath(`/images/currency/${coin}-icon-small.svg`)}
      />
      <style jsx>{`
        .coin-image {
          width: 26px;
          height: 26px;
        }

        .coin-image.transparent {
          opacity: 0.3;
        }

        .coin-image.small {
          width: 14px;
          height: 14px;
        }

        .mixed {
          position: relative;
        }

        .coin-1 {
          z-index: 1;
        }

        .coin-2 {
          z-index: 2;
          margin-left: -9px;
        }

        .coin-3 {
          z-index: 3;
          margin-left: -9px;
        }
      `}</style>
    </div>
  )
}

const CoinSelect = ({ selected }) => {
  return (
    <>
      <div
        className={`coin-select d-flex align-items-center justify-content-start`}
      >
        <CoinImage coin={selected} />
        <div className="coin mr-auto">{`${
          selected === 'wousd' ? 'w' : ''
        }OUSD`}</div>
      </div>
      <style jsx>{`
        .coin-select {
          min-width: 160px;
          min-height: 40px;
          padding: 7px 20px 7px 7px;
          font-size: 18px;
        }

        .coin {
          color: black;
          margin-left: 12px;
        }
      `}</style>
    </>
  )
}

/*
 * selectedCoin - the coin or coin combination to be shown - selected
 * balances - Array of balances to be shown. UI differs when there is only 1 item vs many in the array
 */
const WrapOusdPill = ({
  topItem,
  onAmountChange,
  swapMode,
  onErrorChange,
  coinValue,
  wrapEstimate,
  swapsLoading,
  rate,
}) => {
  const coinBalances = useStoreState(AccountStore, (s) => s.balances)
  const [error, setError] = useState(null)

  const bottomItem = !topItem

  const selectedCoin = swapMode === 'mint' ? 'ousd' : 'wousd'

  const showOusd =
    (swapMode === 'mint' && topItem) || (swapMode === 'redeem' && bottomItem)

  const floorTo2to6Decimals = (value) => {
    return formatCurrencyMinMaxDecimals(value, {
      minDecimals: 2,
      maxDecimals: 6,
      truncate: true,
    })
  }

  const getDisplayBalance = () => {
    const roundTo2Decimals = (value) => {
      return formatCurrency(parseFloat(value), 2)
    }
    if (showOusd) {
      return {
        coin: 'ousd',
        balance: roundTo2Decimals(coinBalances.ousd),
        detailedBalance: coinBalances.ousd || 0,
      }
    } else {
      return {
        coin: 'wousd',
        balance: roundTo2Decimals(coinBalances.wousd),
        detailedBalance: coinBalances.wousd || 0,
      }
    }
  }

  useEffect(() => {
    if (onErrorChange) {
      onErrorChange(error)
    }
  }, [error])

  useEffect(() => {
    checkForBalanceError()
  }, [coinValue, swapMode, selectedCoin])

  const displayBalance = getDisplayBalance()

  useEffect(() => {
    /* User has manually inputted the amount that matches the wallet's balance up to 6th decimal.
     * Add the dust (decimals beyond the 6th one) to the input amount so it is not left behind
     * in the wallet.
     */
    if (
      displayBalance &&
      coinValue &&
      floorTo2to6Decimals(displayBalance.detailedBalance) ===
        floorTo2to6Decimals(coinValue) &&
      removeCommas(displayBalance.detailedBalance) !==
        removeCommas(coinValue) &&
      // this bit is required so that zeroes can be added to input when already at max value
      parseFloat(displayBalance.detailedBalance) !== parseFloat(coinValue)
    ) {
      setMaxBalance()
    }
  }, [coinValue, displayBalance])

  const checkForBalanceError = () => {
    if (bottomItem) {
      return
    }

    setError(parseFloat(coinBalances[selectedCoin]) < parseFloat(coinValue))
  }

  const expectedAmount =
    bottomItem && wrapEstimate && formatCurrency(wrapEstimate, 2)

  const maxBalanceSet =
    topItem &&
    displayBalance &&
    // if balance and input match up to 6th decimal. Consider it effectively as set to max balance
    floorTo2to6Decimals(displayBalance.detailedBalance) ===
      floorTo2to6Decimals(coinValue)

  const balanceClickable =
    topItem &&
    displayBalance &&
    !maxBalanceSet &&
    parseFloat(displayBalance.balance) > 0

  const setMaxBalance = () => {
    if (!displayBalance) {
      return
    }

    const valueNoCommas = removeCommas(displayBalance.detailedBalance)
    onAmountChange(valueNoCommas)
  }

  return (
    <>
      <div
        className={`currency-pill d-flex flex-column ${
          topItem ? 'topItem' : ''
        }`}
      >
        <div
          className={`d-flex align-items-start justify-content-between currency-pill-inner`}
        >
          <div className="d-flex flex-column justify-content-between align-items-start h-100">
            {topItem ? (
              <CoinSelect selected={swapMode === 'mint' ? 'ousd' : 'wousd'} />
            ) : (
              <CoinSelect selected={swapMode === 'mint' ? 'wousd' : 'ousd'} />
            )}

            <div className="d-flex align-items-center">
              <div
                className={`d-flex justify-content-between balance mt-auto mr-2 ${
                  balanceClickable ? 'clickable' : ''
                }`}
                onClick={setMaxBalance}
              >
                {displayBalance && (
                  <div>
                    {fbt(
                      'Balance: ' +
                        fbt.param('coin-balance', displayBalance.balance),
                      'Coin balance'
                    )}
                    <span className="ml-1">
                      {`${displayBalance.coin === 'wousd' ? 'w' : ''}OUSD`}
                    </span>
                  </div>
                )}
                {balanceClickable && (
                  <a className="max-link ml-2" onClick={setMaxBalance}>
                    {fbt('Max', 'Set maximum currency amount')}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="d-flex flex-column justify-content-between align-items-end h-100 input-holder">
            {topItem && (
              <input
                type="text"
                value={truncateDecimals(coinValue, 6)}
                placeholder="0.00"
                onChange={(e) => {
                  // truncate decimals after 6th position
                  const value = truncateDecimals(e.target.value, 6)
                  const valueNoCommas = removeCommas(value)
                  if (checkValidInputForCoin(valueNoCommas, selectedCoin)) {
                    onAmountChange(valueNoCommas)
                  }
                }}
              />
            )}
            {topItem && (
              <div className="balance mt-auto">
                {rate !== null
                  ? fbt(
                      '1 wOUSD = ' +
                        fbt.param('wousd-rate', formatCurrency(rate, 6)) +
                        ' OUSD',
                      'wOUSD conversion rate'
                    )
                  : topItem
                  ? ''
                  : '-'}
              </div>
            )}
            {bottomItem && (
              <div className="expected-value">
                {expectedAmount ||
                  (swapsLoading ? fbt('Loading...', 'Swaps Loading...') : '-')}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .currency-pill {
          min-height: 90px;
          margin-bottom: 10px;
          padding: 10px 23px 14px 10px;
          border: solid 1px #cdd7e0;
          border-radius: 10px;
          background-color: white;
        }

        .currency-pill-inner {
          height: 80px;
        }

        .balance {
          font-size: 12px;
          color: #8293a4;
          margin-left: 4px;
        }

        .mt-20 {
          margin-top: 20px;
        }

        .mt-10 {
          margin-top: 10px;
        }

        .coin {
          width: 15px;
          height: 15px;
          margin-right: 5px;
        }

        input {
          border: 0px;
          text-align: right;
          font-size: 24px;
          color: #183140;
          background-color: transparent;
        }

        .expected-value {
          font-size: 24px;
          color: #8293a4;
        }

        .ml-5px {
          margin-left: 5px;
        }

        .max-link:hover,
        .clickable:hover {
          text-decoration: underline;
        }

        .clickable {
          cursor: pointer;
        }

        .max-link {
          font-size: 12px;
          color: #8293a4;
          weight: bold;
          cursor: pointer;
        }

        @media (max-width: 799px) {
          .input-holder {
            max-width: 50%;
          }

          input {
            font-size: 20px;
          }

          .expected-value {
            font-size: 20px;
          }

          .balance {
            font-size: 10px;
            margin-left: 4px;
            white-space: nowrap;
          }

          .max-link {
            font-size: 10px;
          }
        }
      `}</style>
    </>
  )
}

export default WrapOusdPill
