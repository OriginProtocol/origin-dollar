import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import classnames from 'classnames'

import ToggleSwitch from 'components/buySell/ToggleSwitch'
import { AccountStore } from 'stores/AccountStore'
import { usePrevious } from 'utils/hooks'

const CoinRow = ({ coin, onOusdChange }) => {
  const balance = useStoreState(AccountStore, s => s.balances[coin] || 0)
  const prevBalance = usePrevious(balance)

  const [coinValue, setCoinValue] = useState(balance)
  const exchangeRate = 0.96

  const [total, setTotal] = useState(balance * exchangeRate)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (prevBalance === 0 && balance > 0) {
      setCoinValue(balance)
      setTotal(balance * exchangeRate)
    }
  }, [balance])

  useEffect(() => {
    if (active) {
      onOusdChange(total)
    } else {
      onOusdChange(0)
    }
  }, [total, active])

  const onToggle = (active) => {
    setActive(active)
  }

  return <>
    <div className="coin-row d-flex">
      <div className="coin-holder d-flex">
        <div className="coin-toggle">
          <ToggleSwitch
            coin={coin}
            onToggle={onToggle}
          />
        </div>
        <div className={classnames('coin-input d-flex align-items-center justify-content-start', { active })}>
          <input
            type="number"
            className=""
            placeholder="0.00"
            value={coinValue}
            onChange={e => {
              if (active) {
                setCoinValue(e.target.value)
                setTotal(e.target.value * exchangeRate)
              }
            }}
          />
        </div>
      </div>
      <div className="coin-info d-flex">
        <div className="col-6 currency d-flex align-items-center justify-content-start">
          {active && <div className="total">{total} OUSD</div>}
        </div>
        <div className="col-3 info d-flex align-items-center justify-content-center balance">{exchangeRate}$&#47;{coin}</div>
        <div className="col-3 info d-flex align-items-center justify-content-center balance">{balance} {coin}</div>
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
      }

      .coin-info .total {
        text-transform: uppercase;
        font-size: 18px;
        color: #183140;
      }

      .coin-info .total::before {
        content: "=";
        font-size: 18px;
        margin-right: 15px;
        color: #8293a4;
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
}

export default CoinRow
