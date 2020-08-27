import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'

const BalanceHeader = ({ balances }) => {
  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const [displayedOusdBalance, setDisplayedOusdBalance] = useState(ousdBalance)
  const apy = 0.1534

  useEffect(() => {
    setDisplayedOusdBalance(ousdBalance)
    if (ousdBalance > 0) {
      animateValue({
        from: parseFloat(ousdBalance),
        to: parseFloat(ousdBalance) + (parseFloat(ousdBalance) * apy) / 8760, // 8760 hours withing a calendar year
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
  return (
    <>
      <div className="balance-header d-flex">
        <div className="blue-circle d-flex align-items-center justify-content-center flex-column">
          <div className="gradient-border">
            <div className="inner"></div>
          </div>
          <div className="contents d-flex align-items-center justify-content-center flex-column">
            <div className="light-grey-labe apy-label">APY</div>
            <div className="apy-percentage">{formatCurrency(apy * 100)}</div>
          </div>
        </div>
        <div className="d-flex flex-column align-items-start justify-content-center">
          <div className="light-grey-label">
            {fbt('Current Balance', 'Current Balance')}
          </div>
          <div className="ousd-value">
            {displayedBalance.substring(0, displayedBalance.length - 4)}
            <span className="grey">
              {displayedBalance.substring(displayedBalance.length - 4)}
            </span>
          </div>
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
          
        .balance-header .ousd-value .grey {
          color: #8293a4;
        }

        .balance-header .ousd-value::after {
          content: 'OUSD';
          vertical-align: baseline;
          color: #1e313f;
          font-size: 14px;
          margin-left: 8px;
        }

        .balance-header .blue-circle {
          width: 130px;
          height: 130px;
          border-radius: 65px;
          //border: solid 2px #1a82ff;
          margin-right: 46px;
          position: relative;
        }

        .balance-header .blue-circle .contents {
          z-index: 2;
        }

        .balance-header .gradient-border {
          position: absolute;
          width: 130px;
          height: 130px;
          border-radius: 65px;
          background: linear-gradient(to right, #1a82ff, #4aB2ff);
          padding: 3px;
          z-index: 1;
          animation-name: spin;
          animation-duration: 4000ms;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }

        .balance-header .gradient-border .inner {
          width: 100%;
          height: 100%;
          background-color: white;
          border-radius: 65px;
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
          content: '%';
          font-size: 16px;
          font-weight: bold;
          color: #1e313f;
          vertical-align: super;
        }

        @-ms-keyframes spin {
          from { -ms-transform: rotate(0deg); }
          to { -ms-transform: rotate(360deg); }
        }
        @-moz-keyframes spin {
          from { -moz-transform: rotate(0deg); }
          to { -moz-transform: rotate(360deg); }
        }
        @-webkit-keyframes spin {
          from { -webkit-transform: rotate(0deg); }
          to { -webkit-transform: rotate(360deg); }
        }
        @keyframes spin {
          from {
            transform:rotate(0deg);
          }
          to {
            transform:rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

export default BalanceHeader
