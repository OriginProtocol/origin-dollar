import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import ToggleSwitch from 'components/buySell/ToggleSwitch'
import { AccountStore } from 'stores/AccountStore'

const CoinRow = ({ coin }) => {
  const [coinValue, setCoinValue] = useState(123)
  const balances = useStoreState(AccountStore, s => s.balances)
  const [active, setActive] = useState(false)

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
        <div className={`coin-input d-flex align-items-center justify-content-start ${active ? 'active' : ''}`}>
          <input
            type="number"
            className=""
            placeholder="0.00"
            value={coinValue}
            onChange={e => {
              if (active) {
                setCoinValue(e.target.value)
              }
            }}
          />
        </div>
      </div>
      <div className="coin-info d-flex">
        <div className="col-6 currency d-flex align-items-center justify-content-start ">123</div>
        <div className="col-3 info d-flex align-items-center justify-content-center balance">0.96$&#47;{coin}</div>
        <div className="col-3 info d-flex align-items-center justify-content-center balance">{balances[coin]} {coin}</div>
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
