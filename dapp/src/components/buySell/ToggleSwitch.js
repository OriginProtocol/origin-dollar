import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { usePrevious } from 'utils/hooks'
import analytics from 'utils/analytics'

const ToggleSwitch = ({ coin, onToggle, balance }) => {
  const storageKey = `${coin}_buy_toggle`
  const [defaultState] = useState(balance > 0 ? true : false)
  const [active, setActive] = useState(defaultState)
  const prevBalance = usePrevious(balance)
  const [defaultValSet, setDefaultValSet] = useState(false)

  useEffect(() => {
    onToggle(defaultState, false)
  }, [])

  // by default enable toggles when coin balances are over 0
  useEffect(() => {
    if (defaultValSet) return

    const prevBalanceNum = parseFloat(prevBalance)
    const balanceNum = parseFloat(balance)

    if (
      (prevBalance === undefined ||
        prevBalanceNum === 0 ||
        isNaN(prevBalanceNum)) &&
      balanceNum > 0
    ) {
      setDefaultValSet(true)

      const isActive =
        localStorage[storageKey] && localStorage[storageKey] === 'off'
          ? false
          : true
      setActive(isActive)
      onToggle(isActive, false)
    }
  }, [balance, defaultValSet])

  return (
    <>
      <div
        className={`coin-toggle d-flex align-items-center justify-content-center ${
          active ? 'active' : ''
        }`}
        title={coin.toUpperCase()}
      >
        <div
          className={`background ${coin}`}
          onClick={(e) => {
            e.preventDefault()
            // remember user's setting for the toggle
            localStorage[storageKey] = !active ? 'on' : 'off'
            onToggle(!active, true)
            setActive(!active)
            analytics.track('Buy widget, toggle coin', {
              coin,
              checked: !active,
            })
          }}
        >
          <img
            className={`toggle ${active ? 'active' : ''}`}
            src={`/images/currency/${coin}-switch-button-${
              active ? 'on' : 'off'
            }.svg`}
          />
        </div>
      </div>
      <style jsx>{`
        .coin-toggle {
          cursor: pointer;
          height: 49px;
          padding-bottom: 2px;
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
          background-color: #2775ca;
        }

        .coin-toggle.active .background.usdt {
          background-color: #53ae94;
        }
      `}</style>
    </>
  )
}

export default ToggleSwitch
