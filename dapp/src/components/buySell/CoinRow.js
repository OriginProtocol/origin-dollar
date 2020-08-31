import React, { useState, useEffect, useRef } from 'react'
import { useStoreState } from 'pullstate'
import classnames from 'classnames'

import ToggleSwitch from 'components/buySell/ToggleSwitch'
import { AccountStore } from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'
import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'

const CoinRow = ({ coin, onOusdChange, onCoinChange, exchangeRate, formError, formWarning, reset }) => {
  const textInput = useRef(null)
  const localStorageKey = currencies[coin].localStorageSettingKey
  const balance = useStoreState(AccountStore, (s) => s.balances[coin] || 0)
  const prevBalance = usePrevious(balance)

  const [coinValue, setCoinValue] = useState(balance)
  const [displayedCoinValue, setDisplayedCoinValue] = useState('')

  const [total, setTotal] = useState(balance * exchangeRate)
  const [active, setActive] = useState(false)

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
      (prevBalanceNum === 0 || prevBalanceNum === undefined) &&
      balanceNum > 0
    ) {
      const lastManualSetting = parseFloat(localStorage[localStorageKey])

      let coinValueTo = balanceNum
      if (
        lastManualSetting &&
        lastManualSetting > 0 &&
        lastManualSetting < balanceNum
      ) {
        coinValueTo = lastManualSetting
      }

      setCoinValue(coinValueTo)
      setDisplayedCoinValue(formatCurrency(coinValueTo))
      setTotal(coinValueTo * exchangeRate)
    }
  }, [balance])

  useEffect(() => {
    if (active) {
      onOusdChange(total)
      onCoinChange(coinValue)
    } else {
      onOusdChange(0)
      onCoinChange(0)
    }
  }, [total, active])

  const onToggle = (active) => {
    setActive(active)

    const el = textInput.current

    active ? el.focus() : el.blur()
  }

  return (
    <>
      <div className="coin-row d-flex">
        <div className={`coin-holder d-flex ${!formError && formWarning ? 'warning' : ''} ${formError ? 'error' : ''}`}>
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
              className="text-right"
              placeholder={active ? '0.00' : ''}
              value={active ? displayedCoinValue : ''}
              onChange={(e) => {
                if (active) {
                  const value = e.target.value
                  const valueNoCommas = e.target.value.replace(',', '')
                  setCoinValue(valueNoCommas)
                  setDisplayedCoinValue(value)
                  setTotal(valueNoCommas * exchangeRate)
                  localStorage[localStorageKey] = valueNoCommas
                }
              }}
              onBlur={(e) => {
                setDisplayedCoinValue(formatCurrency(coinValue))
              }}
              onFocus={(e) => {
                if (!coinValue) {
                  setDisplayedCoinValue('')
                }
              }}
            />
          </div>
        </div>
        <div className="coin-info d-flex">
          <div className="col-3 info d-flex align-items-center justify-content-end balance pr-0">
            {formatCurrency(exchangeRate, 4)}&#47;{coin}
          </div>
          <div className="col-4 info d-flex align-items-center justify-content-end balance pr-0">
            {formatCurrency(balance)}&nbsp;{coin}
          </div>
          <div className="col-5 currency d-flex align-items-center">
            {active && (
              <div className="total">{formatCurrency(total)}</div>
            )}
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
          width: 350px;
          height: 50px;
          border-radius: 5px;
          background-color: #f2f3f5;
        }

        .coin-info .balance {
          text-transform: uppercase;
          white-space: nowrap;
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

        .currency {
          font-size: 18px;
          color: #183140;
        }

        .coin-row .coin-info .info {
          font-size: 12px;
          color: #8293a4;
        }
      `}</style>
    </>
  )
}

export default CoinRow
