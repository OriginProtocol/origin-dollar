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
import { useAccount } from 'wagmi'

const CoinImage = ({ small, coin }) => {
  const className = `coin-image`
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

const coinToDisplay = {
  oeth: {
    name: 'Origin Ether',
    symbol: 'OETH',
  },
  woeth: {
    name: 'Wrapped Origin Ether',
    symbol: 'WOETH',
  },
}

const CoinSelect = ({ selected }) => {
  return (
    <>
      <div
        className={`coin-select d-flex align-items-center justify-content-end`}
      >
        <CoinImage coin={selected} />
        <div className="coin">{`${selected === 'woeth' ? 'w' : ''}OETH`}</div>
      </div>
      <style jsx>{`
        .coin-select {
          min-width: 160px;
          padding: 0 16px;
          font-size: 18px;
        }

        .coin {
          color: #fafbfb;
          margin-left: 12px;
        }

        @media (max-width: 799px) {
          .coin-select {
            padding: 0;
          }
        }
      `}</style>
    </>
  )
}

/*
 * selectedCoin - the coin or coin combination to be shown - selected
 * balances - Array of balances to be shown. UI differs when there is only 1 item vs many in the array
 */
const WrapOETHPill = ({
  topItem,
  onAmountChange,
  swapMode,
  onErrorChange,
  coinValue,
  wrapEstimate,
  swapsLoading,
  rate,
  ethPrice,
}) => {
  const coinBalances = useStoreState(AccountStore, (s) => s.balances)
  const [error, setError] = useState(null)
  const { isConnected: active } = useAccount()

  const bottomItem = !topItem

  const selectedCoin = swapMode === 'mint' ? 'oeth' : 'woeth'

  const showOeth =
    (swapMode === 'mint' && topItem) || (swapMode === 'redeem' && bottomItem)

  const floorTo2to18Decimals = (value) => {
    return formatCurrencyMinMaxDecimals(value, {
      minDecimals: 2,
      maxDecimals: 18,
      truncate: true,
    })
  }

  const getDisplayBalance = () => {
    const roundDecimals = (value) => {
      return formatCurrencyMinMaxDecimals(parseFloat(value), {
        minDecimals: 2,
        maxDecimals: 18,
        truncate: true,
      })
    }
    if (!active) {
      return null
    } else if (showOeth) {
      return {
        coin: 'oeth',
        balance: roundDecimals(coinBalances.oeth),
        detailedBalance: coinBalances.oeth || 0,
      }
    } else {
      return {
        coin: 'woeth',
        balance: roundDecimals(coinBalances.woeth),
        detailedBalance: coinBalances.woeth || 0,
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
      floorTo2to18Decimals(displayBalance.detailedBalance) ===
        floorTo2to18Decimals(coinValue) &&
      removeCommas(displayBalance.detailedBalance) !==
        removeCommas(coinValue) &&
      // this bit is required so that zeroes can be added to input when already at max value
      parseFloat(displayBalance.detailedBalance) !==
        parseFloat(floorTo2to18Decimals(coinValue))
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
    bottomItem && wrapEstimate && formatCurrency(wrapEstimate, 6)

  const maxBalanceSet =
    topItem &&
    displayBalance &&
    // if balance and input match up to 6th decimal. Consider it effectively as set to max balance
    floorTo2to18Decimals(displayBalance.detailedBalance) ===
      floorTo2to18Decimals(coinValue)

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
          className={`d-flex align-items-center justify-content-between currency-pill-inner`}
        >
          <div
            className={`d-flex flex-column justify-content-between input-holder w-full relative`}
          >
            {topItem && (
              <input
                inputMode="decimal"
                type="text"
                value={truncateDecimals(coinValue, 18)}
                placeholder="0.00"
                onChange={(e) => {
                  // truncate decimals after 6th position
                  const value = truncateDecimals(e.target.value, 18)
                  const valueNoCommas = removeCommas(value)
                  if (checkValidInputForCoin(valueNoCommas, selectedCoin)) {
                    onAmountChange(valueNoCommas)
                  }
                }}
              />
            )}
            {bottomItem && (
              <div className={`expected-value ${expectedAmount ? '' : 'grey'}`}>
                {swapsLoading ? (
                  <span className="text-loading">
                    {fbt('Loading...', 'Swaps Loading...')}
                  </span>
                ) : (
                  <span>{expectedAmount || '0.00'}</span>
                )}
              </div>
            )}
          </div>
          <div className="d-flex flex-column justify-content-between align-items-end output-holder">
            {topItem && (
              <div className="d-flex align-items-center">
                <div className="d-flex justify-content-between balance">
                  {displayBalance && (
                    <div>
                      <p className="balance-text">
                        {fbt(
                          'Balance: ' +
                            fbt.param(
                              'coin-balance',
                              formatCurrency(displayBalance.balance, 6)
                            ),
                          'Coin balance'
                        )}{' '}
                      </p>
                    </div>
                  )}
                  {balanceClickable && (
                    <button className="max-link ml-2" onClick={setMaxBalance}>
                      {fbt('max', 'Set maximum currency amount')}
                    </button>
                  )}
                </div>
              </div>
            )}
            {topItem ? (
              <CoinSelect selected={swapMode === 'mint' ? 'oeth' : 'woeth'} />
            ) : (
              <CoinSelect selected={swapMode === 'mint' ? 'woeth' : 'oeth'} />
            )}
            {topItem && (
              <div className="balance mt-2">
                {rate !== null
                  ? fbt(
                      '1 wOETH = ' +
                        fbt.param('woeth-rate', formatCurrency(rate, 6)) +
                        ' OETH',
                      'wOETH conversion rate'
                    )
                  : topItem
                  ? ''
                  : '-'}
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .grey {
          color: #828699 !important;
        }

        .output-holder {
          max-width: 50%;
        }

        .currency-pill {
          display: flex;
          justify-content: center;
          padding: 24px 40px;
          background-color: #1e1f25;
          min-height: 150px;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
        }

        .topItem {
          background-color: #18191c;
          border-bottom: solid 1px #141519;
          border-radius: 0;
        }

        .currency-pill-inner {
        }

        .balance {
          font-size: 14px;
          color: #828699;
          margin-left: 4px;
          margin-bottom: 12px;
        }

        .balance-text {
          whitespace: nowrap;
          margin: 0;
        }

        .usd-balance {
          font-size: 16px;
          color: #828699;
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
          font-family: Sailec;
          border: 0px;
          max-width: 100%;
          text-align: left;
          font-size: 32px;
          color: #fafbfb;
          background-color: transparent;
        }

        input::placeholder {
          /* Chrome, Firefox, Opera, Safari 10.1+ */
          color: #828699;
        }

        input:-ms-input-placeholder {
          /* Internet Explorer 10-11 */
          color: #828699;
        }

        input::-ms-input-placeholder {
          /* Microsoft Edge */
          color: #828699;
        }

        .expected-value {
          font-size: 32px;
          max-width: 100%;
          text-overflow: ellipsis;
          display: block;
          overflow: hidden;
          color: #fafafb;
          font-weight: 700;
        }

        .expected-value .text-loading {
          font-size: 16px;
        }

        .expected-value p {
          white-space: nowrap;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
          overflow: hidden;
        }

        .ml-5px {
          margin-left: 5px;
        }

        .max-link:hover,
        .clickable:hover {
          background: rgba(250, 251, 251, 0.15);
        }

        .clickable {
          cursor: pointer;
        }

        .max-link {
          display: flex;
          align-items: center;
          justify-center: center;
          font-family: Sailec;
          border: none;
          font-size: 12px;
          color: #828699;
          weight: bold;
          cursor: pointer;
          width: 32px;
          height: 18px;
          padding: 2px 4px;
          background: rgba(250, 251, 251, 0.1);
          border-radius: 4px;
        }

        .input-holder {
          width: 100%;
          max-width: 70%;
        }

        .input-holder input {
          font-size: 32px;
          font-weight: 700;
        }

        @media (max-width: 799px) {
          .currency-pill {
            padding: 0 16px;
          }

          .input-holder {
            max-width: 50%;
            padding: 32px 0;
          }

          .input-holder input {
            font-size: 24px;
          }

          .expected-value {
            font-size: 24px;
          }

          .balance {
            font-size: 12px;
            margin-left: 4px;
            white-space: nowrap;
            margin-bottom: 16px;
          }
        }
      `}</style>
    </>
  )
}

export default WrapOETHPill
