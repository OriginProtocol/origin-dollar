import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'

const BalanceHeader = ({ balances }) => {
  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )

  const apy = useStoreState(ContractStore, (s) => s.apr || 0)
  const [displayedOusdBalance, setDisplayedOusdBalance] = useState(ousdBalance)
  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)

  const normalOusdAnimation = () => {
    animateValue({
      from: parseFloat(ousdBalance),
      to: parseFloat(ousdBalance) + (parseFloat(ousdBalance) * apy) / 8760, // 8760 hours withing a calendar year
      callbackValue: (value) => {
        setDisplayedOusdBalance(value)
      },
      duration: 3600 * 1000, // animate for 1 hour
      id: 'header-balance-ousd-animation',
    })
  }

  useEffect(() => {
    setDisplayedOusdBalance(ousdBalance)
    if (ousdBalance > 0) {
      // user must have minted the OUSD
      if (prevOusdBalance && ousdBalance - prevOusdBalance > 5) {
        setBalanceEmphasised(true)
        animateValue({
          from: parseFloat(prevOusdBalance),
          to: parseFloat(ousdBalance),
          callbackValue: (value) => {
            setDisplayedOusdBalance(value)
          },
          onCompleteCallback: () => {
            setBalanceEmphasised(false)
            normalOusdAnimation()
          },
          // non even duration number so more of the decimals in ousdBalance animate
          duration: 1985,
          id: 'header-balance-ousd-animation',
          stepTime: 30,
        })
      } else {
        normalOusdAnimation()
      }
    }
  }, [ousdBalance])

  const displayedBalance = formatCurrency(displayedOusdBalance || 0, 6)
  const displayedBalanceNum = parseFloat(displayedBalance)
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
        <div className="d-flex flex-column align-items-center align-items-md-start justify-content-center">
          <div className="light-grey-label">
            {fbt('Current Balance', 'Current Balance')}
          </div>
          <div className={`ousd-value ${balanceEmphasised ? 'big' : ''}`}>
            {displayedBalanceNum !== 0 && (
              <>
                {' '}
                {displayedBalance.substring(0, displayedBalance.length - 4)}
                <span className="grey">
                  {displayedBalance.substring(displayedBalance.length - 4)}
                </span>
              </>
            )}
            {displayedBalanceNum === 0 && '00000.00'}
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
          color: #183140;
          transition: font-size 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5),
            color 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5);
        }

        .balance-header .ousd-value.big {
          color: #00d592;
        }

        .balance-header .ousd-value .grey {
          color: #8293a4;
        }

        .balance-header .ousd-value::after {
          content: 'OUSD';
          vertical-align: baseline;
          color: #183140;
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
          background: linear-gradient(to right, #1a82ff, #4ab2ff);
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
          color: #183140;
          margin-bottom: 5px;
        }

        .balance-header .blue-circle .apy-percentage::after {
          content: '%';
          font-size: 16px;
          font-weight: bold;
          color: #183140;
          vertical-align: super;
        }

        @-ms-keyframes spin {
          from {
            -ms-transform: rotate(0deg);
          }
          to {
            -ms-transform: rotate(360deg);
          }
        }
        @-moz-keyframes spin {
          from {
            -moz-transform: rotate(0deg);
          }
          to {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          from {
            -webkit-transform: rotate(0deg);
          }
          to {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 799px) {
          .balance-header {
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding-top: 50px;
          }

          .balance-header .blue-circle {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            margin-right: 0;
          }

          .balance-header .ousd-value {
            font-size: 28px;
          }

          .balance-header .light-grey-label {
            margin-top: 35px;
          }
        }
      `}</style>
    </>
  )
}

export default BalanceHeader
