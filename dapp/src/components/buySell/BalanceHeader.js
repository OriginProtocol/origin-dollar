import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'

const BalanceHeader = ({ balances }) => {
  const ousdBalance = useStoreState(AccountStore, s => s.balances['ousd'] || 0)
  const [ displayedOusdBalance, setDisplayedOusdBalance ] = useState(ousdBalance)
  const apy = 0.1534

  useEffect(() => {
    setDisplayedOusdBalance(ousdBalance)
    if (ousdBalance > 0) {
      animateValue({
        from: parseFloat(ousdBalance),
        to: parseFloat(ousdBalance) + parseFloat(ousdBalance) * apy / 8760, // 8760 hours withing a calendar year
        callbackValue: (value) => {
          setDisplayedOusdBalance(value)
          //console.log(value, parseFloat(ousdBalance) * apy / 8760)
        },
        duration: 3600 * 1000, // animate for 1 hour
        id: 'header-balance-ousd-animation',

      })
    }
  }, [ousdBalance])

  const displayedBalance = formatCurrency(displayedOusdBalance, 6)
  return <>
    <div className="balance-header d-flex">
      <div className="blue-circle d-flex align-items-center justify-content-center flex-column">
        <div className="light-grey-labe apy-label">APY</div>
        <div className="apy-percentage">{ formatCurrency(apy * 100)}</div>
      </div>
      <div className="d-flex flex-column align-items-start justify-content-center">
        <div className="light-grey-label">{fbt('Current Balance', 'Current Balance')}</div>
        <div className="ousd-value">{displayedBalance.substring(0,displayedBalance.length - 6)}<span className="grey">{displayedBalance.substring(displayedBalance.length - 6)}</span></div>
      </div>
    </div>
    <style jsx>{`
      .balance-header {
        min-height: 200px;
        padding: 35px;
      }

      .balance-header .light-grey-label {
        font-size: 14px;
        font-weight: bold;
        color: #8293a4;
      }

      .balance-header .ousd-value {
        font-size: 36px;
        color: #1e313f;
      }

      .balance-header .ousd-value::after {
        content: "OUSD";
        vertical-align: baseline;
        color: #1e313f;
        font-size: 14px;
        margin-left: 8px;
      }

      .balance-header .blue-circle {
        width: 130px;
        height: 130px;
        border-radius: 65px;
        border: solid 2px #1a82ff;
        margin-right: 46px;
      }

      .balance-header .blue-circle .apy-label {
        margin-bottom: -8px;
      }

      .balance-header .blue-circle .apy-percentage {
        font-size: 36px;
        text-align: center;
        color: #1e313f;
        margin-bottom: 5px;
      }

      .balance-header .blue-circle .apy-percentage::after {
        content: "%";
        font-size: 16px;
        font-weight: bold;
        color: #1e313f;
        vertical-align: super;
      }
    `}</style>
  </>
}

export default BalanceHeader
  