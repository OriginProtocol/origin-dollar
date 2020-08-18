import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { usePrevious } from 'utils/hooks'

const ToggleSwitch = ({ coin, onToggle, balance }) => {
  const defaultState = balance > 0 ? true : false
  const [active, setActive] = useState(defaultState)
  const prevBalance = usePrevious(balance)

  useEffect(() => {
    onToggle(defaultState)
  }, [])
  
  // by default enable toggles when coin balances are over 0
  useEffect(() => {
    if (prevBalance === 0 && balance > 0) {
      setActive(true)
      onToggle(true)
    }
  }, [balance])

  return <>
    <div className={`coin-toggle d-flex align-items-center justify-content-center ${active ? 'active' : ''}`}>
      <div
        className={`background ${coin}`}
        onClick={e => {
          e.preventDefault()
          onToggle(!active)
          setActive(!active)
        }}
      >
        <img className={`toggle ${active ? 'active' : ''}`} src={`/images/currency/${coin}-switch-button-${active ? 'on' : 'off'}.svg`}/>
      </div>
    </div>
    <style jsx>{`
      .coin-toggle {
        cursor: pointer;
        height: 49px;
      }

      .coin-toggle .background {
        width: 50px;
        height: 10px;
        border-radius: 15px;
        background-color: #bbc9da;
        transition: background-color 0.2s linear;
        position: relative;
      }

      .coin-toggle .background .toggle {
        position: absolute;
        top: -14px;
        left: -6px;
        transition: left 0.2s linear;
      }

      .coin-toggle .background .toggle.active {
        left: 17px;
      }

      .coin-toggle.active .background.dai {
        background-color: #ffce45;
      }

      .coin-toggle.active .background.usdc {
        background-color: #2775CA
      }

      .coin-toggle.active .background.usdt {
        background-color: #53AE94
      }
    `}</style>
  </>
}

export default ToggleSwitch
