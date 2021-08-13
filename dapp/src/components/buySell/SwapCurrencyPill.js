import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import Dropdown from 'components/Dropdown'
import { usePrevious } from 'utils/hooks'
import analytics from 'utils/analytics'
import {
  formatCurrency,
  truncateDecimals,
  checkValidInputForCoin,
} from 'utils/math'
import { currencies } from 'constants/Contract'

const DownCaret = ({ color = '#608fcf', size = '30' }) => (
  <svg
    style={{ marginRight: -13 }}
    width={size}
    height={size}
    viewBox="0 0 20 20"
  >
    <g stroke={color} strokeWidth="1" strokeLinecap="round">
      <line x1="7" y1="9" x2="10" y2="12" />
      <line x1="10" y1="12" x2="13" y2="9" />
    </g>
  </svg>
)

const CoinImage = ({ small, coin }) => {
  return (
    <div className="d-flex align-items-center">
      {coin !== 'mix' && (
        <img
          className={`coin-image ${small ? 'small' : ''}`}
          src={`/images/currency/${coin}-icon-small.svg`}
        />
      )}
      {coin === 'mix' && (
        <div className="d-flex align-items-start">
          <img
            className={`coin-image mixed coin-1 ${small ? 'small' : ''}`}
            src={`/images/currency/dai-icon-small.svg`}
          />
          <img
            className={`coin-image mixed coin-2 ${small ? 'small' : ''}`}
            src={`/images/currency/usdt-icon-small.svg`}
          />
          <img
            className={`coin-image mixed coin-3 ${small ? 'small' : ''}`}
            src={`/images/currency/usdc-icon-small.svg`}
          />
        </div>
      )}
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

const CoinSelect = ({ selected, onChange, options = [] }) => {
  const [open, setOpen] = useState(false)

  if (options.length === 0) {
    return (
      <>
        <div
          className={`coin-select d-flex align-items-center justify-content-start`}
        >
          <CoinImage coin={selected} />
          <div className="coin text-uppercase mr-auto">{selected}</div>
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

  return (
    <>
      <Dropdown
        content={
          <div className="dropdown-menu show wrapper d-flex flex-column">
            {options.map((option) => {
              return (
                <div
                  key={option}
                  className="d-flex justify-content-start align-items-center p-5px dropdown-item"
                  onClick={(e) => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <CoinImage coin={option} />
                  <div className="coin text-uppercase mr-auto">{option}</div>
                </div>
              )
            })}
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <div
          className={`coin-select d-flex align-items-center justify-content-start`}
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          <CoinImage coin={selected} />
          <div className="coin text-uppercase mr-auto">{selected}</div>
          <DownCaret />
        </div>
      </Dropdown>
      <style jsx>{`
        .dropdown-menu {
          padding: 10px;
          right: auto;
          left: 0;
          top: 100%;
        }

        .coin-select {
          min-width: 160px;
          min-height: 40px;
          padding: 7px 20px 7px 7px;
          border-radius: 20px;
          border: solid 1px #cdd7e0;
          background-color: white;
          cursor: pointer;
        }

        .coin-select:hover {
          background-color: #f2f3f5;
        }

        .p-5px {
          padding: 5px;
        }

        .single-coin {
          width: 26px;
          height: 26px;
        }

        .cursor-pointer {
          cursor: pointer;
        }

        .dropdown-item {
          cursor: pointer;
        }

        .dropdown-item:hover {
          background-color: #f2f3f5;
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
const SwapCurrencyPill = ({
  topItem,
  onSelectChange,
  onAmountChange,
  amountEditable,
  selectedCoin,
  bestSwap,
  priceToleranceValue,
  swapMode,
  onErrorChange,
}) => {
  const coinBalances = useStoreState(AccountStore, (s) => s.balances)
  const [coinValue, setCoinValue] = useState('')
  const [error, setError] = useState(null)
  const stableCoinMintOptions = ['dai', 'usdt', 'usdc']
  const coinRedeemOptions = ['mix', 'dai', 'usdt', 'usdc']

  const bottomItem = !topItem
  const showOusd =
    (swapMode === 'redeem' && topItem) || (swapMode === 'mint' && bottomItem)

  const getDisplayBalance = () => {
    if (showOusd) {
      return {
        coin: 'ousd',
        balance: coinBalances.ousd,
      }
    } else {
      if (selectedCoin === 'mix') {
        // don't show stablecoin balance when mix stablecoin breakdown shall be displayed
        return null
      } else {
        return {
          coin: selectedCoin,
          balance: coinBalances[selectedCoin],
        }
      }
    }
  }

  const getSelectOptions = () => {
    if (showOusd) {
      return []
    } else {
      if (topItem) {
        return stableCoinMintOptions
      } else {
        return coinRedeemOptions
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

  const checkForBalanceError = () => {
    if (bottomItem) {
      return
    }

    const coin = swapMode === 'mint' ? selectedCoin : 'ousd'

    setError(
      parseFloat(coinBalances[coin]) < parseFloat(coinValue)
        ? fbt('Insufficient balance', 'Insufficient balance for swapping')
        : null
    )
  }

  const displayBalance = getDisplayBalance()
  const coinsSelectOptions = getSelectOptions()
  const expectedAmount =
    bottomItem &&
    bestSwap &&
    bestSwap.amountReceived &&
    formatCurrency(bestSwap.amountReceived, 2)
  const minReceived =
    bottomItem && bestSwap && bestSwap.amountReceived && priceToleranceValue
      ? bestSwap.amountReceived -
        (bestSwap.amountReceived * priceToleranceValue) / 100
      : null

  const coinSplits = bottomItem && bestSwap && bestSwap.coinSplits
  const maxBalanceSet = displayBalance && parseFloat(displayBalance.balance) === parseFloat(coinValue)
  const balanceClickable = topItem && displayBalance && !maxBalanceSet && !error

  const onMaxBalanceClick = (e) => {
    e.preventDefault()
    if (!balanceClickable || !displayBalance) {
      return
    }
    setCoinValue(displayBalance.balance)
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
            <CoinSelect
              selected={showOusd ? 'ousd' : selectedCoin}
              onChange={(coin) => {
                onSelectChange(coin)
              }}
              options={coinsSelectOptions}
            />
            <div className="d-flex align-items-center">
              <div
                className={`d-flex justify-content-between balance mt-auto mr-2 ${balanceClickable ? 'clickable' : ''}`}
                onClick={onMaxBalanceClick}
              >
                {displayBalance && (
                  <div>
                    {fbt(
                      'Balance: ' +
                        fbt.param(
                          'coin-balance',
                          formatCurrency(coinBalances[displayBalance.coin], 2)
                        ),
                      'Coin balance'
                    )}
                    <span className="text-uppercase ml-1">
                      {displayBalance.coin}
                    </span>
                  </div>
                )}
              </div>
              {balanceClickable && <a
                className="max-link"
                onClick={onMaxBalanceClick}
              >
                {fbt('Max', 'Set maximum currency amount')}
              </a>}
            </div>
            </div>
          <div className="d-flex flex-column justify-content-between align-items-end h-100">
            {topItem && (
              <input
                type="text"
                value={coinValue}
                placeholder="0.00"
                onChange={(e) => {
                  const value = truncateDecimals(e.target.value)
                  const valueNoCommas = value.replace(/,/g, '')
                  if (checkValidInputForCoin(valueNoCommas, selectedCoin)) {
                    setCoinValue(valueNoCommas)
                    onAmountChange(valueNoCommas)
                  }
                }}
              />
            )}
            {topItem && error && <div className="error">{error}</div>}
            {bottomItem && (
              <div className="expected-value">{expectedAmount || '-'}</div>
            )}
            {bottomItem && (
              <div className="balance mt-auto">
                {minReceived !== null
                  ? fbt(
                      'Min. received: ' +
                        fbt.param(
                          'ousd-amount',
                          formatCurrency(minReceived, 2)
                        ) +
                        ' OUSD',
                      'Min OUSD amount received'
                    )
                  : topItem
                  ? ''
                  : '-'}
              </div>
            )}
          </div>
        </div>
        {coinSplits && (
          <div className="d-flex flex-column multiple-balance-holder">
            {coinSplits.map((split) => {
              return (
                <div
                  className="d-flex justify-content-between align-items-center balance multiple-balance"
                  key={split.coin}
                >
                  <div className="d-flex justify-content-start align-items-center">
                    <CoinImage small coin={split.coin} />
                    <div className="text-uppercase ml-5px">{split.coin}</div>
                  </div>
                  <div>{formatCurrency(split.amount, 2)}</div>
                </div>
              )
            })}
          </div>
        )}
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

        .currency-pill.topItem {
          background-color: #fafbfc;
        }

        .balance {
          font-size: 12px;
          color: #8293a4;
          margin-left: 4px;
        }

        .error {
          font-size: 12px;
          color: #ed2a28;
          margin-left: 4px;
        }

        .multiple-balance {
          margin-top: 6px;
        }

        .multiple-balance-holder {
          border-top: 1px solid #cdd7e0;
          margin-left: -10px;
          margin-right: -24px;
          padding-left: 10px;
          padding-right: 24px;
          margin-top: 10px;
          padding-top: 4px;
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

      `}</style>
    </>
  )
}

export default SwapCurrencyPill
