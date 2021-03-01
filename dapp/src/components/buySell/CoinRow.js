import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useStoreState } from 'pullstate'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'

import ToggleSwitch from 'components/buySell/ToggleSwitch'
import AccountStore from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { currencies } from 'constants/Contract'
import {
  formatCurrency,
  formatCurrencyMinMaxDecimals,
  truncateDecimals,
  checkValidInputForCoin,
} from 'utils/math'

const CoinRow = ({
  coin,
  onOusdChange,
  onCoinChange,
  exchangeRate,
  formError,
  formWarning,
  reset,
  downsized,
  onActive,
}) => {
  const textInput = useRef(null)
  const localStorageKey = currencies[coin].localStorageSettingKey
  const _balance = useStoreState(AccountStore, (s) => s.balances[coin] || 0)
  const balance = useMemo(() => truncateDecimals(_balance), [_balance])
  const prevBalance = usePrevious(balance)

  const [coinValue, setCoinValue] = useState(balance)
  const [displayedCoinValue, setDisplayedCoinValue] = useState(
    formatCurrency(balance)
  )

  exchangeRate = Math.min(exchangeRate, 1)

  const [total, setTotal] = useState(truncateDecimals(balance * exchangeRate))
  const [active, setActive] = useState(false)

  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (reset) {
      setCoinValue(0)
      setDisplayedCoinValue('')
      setTotal(0)
    }
  }, [reset])

  useEffect(() => {
    const prevBalanceNum = parseFloat(prevBalance)
    const balanceNum = parseFloat(balance)

    if (
      (prevBalanceNum === 0 ||
        prevBalanceNum === undefined ||
        isNaN(prevBalanceNum)) &&
      balanceNum > 0
    ) {
      const lastManualSetting = parseFloat(
        truncateDecimals(localStorage[localStorageKey])
      )

      let coinValueTo = balanceNum

      if (
        lastManualSetting !== undefined &&
        !isNaN(lastManualSetting) &&
        lastManualSetting < balanceNum
      ) {
        coinValueTo = lastManualSetting
      }

      setCoinValue(coinValueTo)
      setDisplayedCoinValue(formatCurrency(coinValueTo))
      setTotal(truncateDecimals(coinValueTo * exchangeRate))
    } else {
      setTotal(truncateDecimals(coinValue * exchangeRate))
    }
  }, [balance, exchangeRate])

  useEffect(() => {
    if (active) {
      onOusdChange(parseFloat(truncateDecimals(total, 2)) || 0)
      onCoinChange(coinValue)
    } else {
      onOusdChange(0)
      onCoinChange(0)
    }
  }, [total, active])

  const onMax = () => {
    setCoinValue(balance)
    setDisplayedCoinValue(
      formatCurrencyMinMaxDecimals(balance, {
        minDecimals: 2,
        maxDecimals: 6,
      })
    )
    setTotal(truncateDecimals(balance * exchangeRate))
    localStorage[localStorageKey] = truncateDecimals(balance)
  }

  const onToggle = (active, isUserInitiated) => {
    setActive(active)
    if (onActive) {
      onActive(active)
    }

    const el = textInput.current

    // we need to call el.focus() with 1 frame delay, otherwise onBlur and onFocus input events are called
    // on initialisation and that messes up the displayed OUSD value.
    setTimeout(() => {
      // intentionally do not call onBlur, since it produces unwanted side effects in onBlur input field event
      if (active) {
        el.focus()
      }
    }, 1)
  }

  return (
    <>
      <div className="coin-row d-flex">
        <div
          className={`coin-holder d-flex ${
            !formError && formWarning ? 'warning' : ''
          } ${formError ? 'error' : ''}`}
        >
          <div className="coin-toggle">
            <ToggleSwitch coin={coin} balance={balance} onToggle={onToggle} />
          </div>
          <div
            className={classnames(
              'coin-input d-flex align-items-center justify-content-start',
              { active }
            )}
          >
            <input
              type="float"
              ref={textInput}
              disabled={!active}
              className="text-right"
              placeholder={active ? '0.00' : ''}
              value={active ? displayedCoinValue : ''}
              onChange={(e) => {
                if (active) {
                  const value = truncateDecimals(e.target.value)
                  const valueNoCommas = value.replace(/,/g, '')
                  if (checkValidInputForCoin(valueNoCommas, coin)) {
                    setCoinValue(valueNoCommas)
                    setDisplayedCoinValue(valueNoCommas)
                    setTotal(truncateDecimals(valueNoCommas * exchangeRate))
                    localStorage[localStorageKey] = valueNoCommas
                  }
                }
              }}
              onBlur={(e) => {
                /* using format currency on blur so it gets formatted as a number
                 * even when user inputs letters.
                 */
                setDisplayedCoinValue(
                  formatCurrencyMinMaxDecimals(coinValue, {
                    minDecimals: 2,
                    maxDecimals: 18,
                  })
                )
              }}
              onFocus={(e) => {
                if (!coinValue) {
                  setDisplayedCoinValue('')
                }
              }}
            />
          </div>
        </div>
        <div className="coin-info d-md-flex flex-grow d-none">
          <div className="col-3 info d-flex align-items-center justify-content-end balance pr-0">
            {formatCurrency(exchangeRate, 4)}&#47;{coin.toUpperCase()}
          </div>
          <div className="col-4 info d-flex align-items-center justify-content-end balance pr-0">
            <a
              className={active ? '' : 'disabled'}
              onClick={active ? onMax : undefined}
            >
              {formatCurrencyMinMaxDecimals(balance, {
                minDecimals: 2,
                maxDecimals: 2,
                floorInsteadOfRound: true,
              })}
              &nbsp;{coin}
            </a>
          </div>
          <div className="col-5 currency d-flex align-items-center">
            {active && (
              <div className={classnames('total', { downsized })}>
                {formatCurrency(total, 2)}
              </div>
            )}
          </div>
        </div>
        <div
          className="coin-info flex-grow d-flex d-md-none"
          onClick={() => setShowMore(!showMore)}
        >
          <img src="/images/more-icon.svg" className="more-icon" />
          {active && <div className="total">{formatCurrency(total, 2)}</div>}
        </div>
      </div>
      <div className={`more-info d-md-none ${showMore ? '' : 'hidden'}`}>
        <div>
          <div className="label">{fbt('Exchange Rate', 'Exchange Rate')}</div>
          <div>
            {formatCurrency(exchangeRate, 4)}&#47;{coin.toUpperCase()}
          </div>
        </div>
        <div>
          <div className="label">{fbt('Your Balance', 'Your Balance')}</div>
          <div className="balance">
            <a
              className={active ? '' : 'disabled'}
              onClick={active ? onMax : undefined}
            >
              {balance}
              &nbsp;{coin.toUpperCase()}
            </a>
          </div>
        </div>
      </div>
      <style jsx>{`
        .coin-row {
          margin-bottom: 11px;
        }

        .coin-row .coin-holder {
          width: 190px;
          height: 49px;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
        }

        .coin-row .coin-holder.error {
          border: solid 1px #ed2a28;
        }

        .coin-row .coin-holder.warning {
          border: solid 1px #eaad00;
        }

        .coin-row .coin-holder .coin-toggle {
          margin: -1px;
          border-radius: 5px 0px 0px 5px;
          border: solid 1px #cdd7e0;
          background-color: #fafbfc;
          height: 49px;
          width: 70px;
          min-width: 70px;
        }

        .coin-input {
          width: 190px;
          background-color: #f2f3f5;
          border-radius: 0px 5px 5px 0px;
          border: solid 1px #cdd7e0;
          margin: -1px;
          color: #8293a4;
        }

        .coin-input input:focus {
          outline: none;
        }

        .coin-row .coin-holder.error .coin-toggle {
          border: solid 1px #ed2a28;
        }

        .coin-holder.error .coin-input {
          border: solid 1px #ed2a28;
        }

        .coin-row .coin-holder.warning .coin-toggle {
          border: solid 1px #eaad00;
        }

        .coin-holder.warning .coin-input {
          border: solid 1px #eaad00;
        }

        .coin-input.active {
          background-color: white;
          color: black;
        }

        .coin-row .coin-holder .coin-input input {
          background-color: transparent;
          width: 80%;
          border: 0px;
          font-size: 18px;
          margin-left: 15px;
        }

        .coin-row .coin-info {
          margin-left: 10px;
          min-width: 350px;
          height: 50px;
          border-radius: 5px;
          background-color: #f2f3f5;
        }

        .coin-info .balance {
          text-transform: uppercase;
          white-space: nowrap;
        }

        .balance a:hover {
          color: black;
          cursor: pointer;
        }

        .balance a.disabled:hover {
          color: inherit;
          cursor: text;
        }

        .coin-info .currency::before {
          content: '=';
          font-size: 18px;
          margin-right: 15px;
          color: #8293a4;
        }

        .coin-info .total {
          text-transform: uppercase;
          font-size: 18px;
          color: #183140;
          text-align: right;
          width: 100%;
        }

        .coin-info .total.downsized {
          font-size: 12px;
        }

        .currency {
          font-size: 18px;
          color: #183140;
        }

        .coin-row .coin-info .info {
          font-size: 12px;
          color: #8293a4;
        }

        @media (max-width: 799px) {
          .coin-row .coin-holder {
            flex: 1;
            width: auto;
            min-width: 48.5%;
            max-width: 48.5%;
          }
          .coin-row .coin-input {
            width: 100%;
          }

          .coin-row .coin-holder .coin-input input {
            margin-left: 10px;
          }

          .coin-row .coin-info .total {
            padding: 0 10px;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .coin-row .coin-info {
            flex: 1;
            width: auto;
            min-width: 45%;
            max-width: 50%;

            cursor: pointer;
            align-items: center;
            justify-content: center;
          }

          .more-info {
            border-radius: 5px;
            background-color: #f2f3f5;
            padding: 10px 20px;
            display: flex;
            font-size: 12px;
            color: #8293a4;
            margin-bottom: 0.75rem;
          }

          .more-info.hidden {
            display: none;
          }

          .more-info > div {
            flex: 1 0 0;
            width: 50%;
          }

          .more-info .label {
            font-weight: bold;
          }

          .more-icon {
            margin: 0 auto 0 10px;
          }
        }
      `}</style>
    </>
  )
}

export default CoinRow
