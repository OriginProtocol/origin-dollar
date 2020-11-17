import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import AnimatedOusdStore from 'stores/AnimatedOusdStore'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'

import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import useExpectedYield from 'utils/useExpectedYield'

const BalanceHeader = () => {
  const apy = useStoreState(ContractStore, (s) => s.apy || 0)
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const ousdBalanceLoaded = typeof ousdBalance === 'string'
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const animatedOusdBalanceLoaded = typeof animatedOusdBalance === 'number'
  const mintAnimationLimit = 0.5
  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)
  const [calculateDropdownOpen, setCalculateDropdownOpen] = useState(false)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const { animatedExpectedIncrease } = useExpectedYield()

  const normalOusdAnimation = (from, to) => {
    setBalanceEmphasised(true)
    const values = [parseFloat(from) || 0, parseFloat(to)]
    let [startVal, endVal] = values

    const reverseOrder = startVal > endVal
    if (reverseOrder) {
      ;[endVal, startVal] = values
    }

    return animateValue({
      from: startVal,
      to: endVal,
      callbackValue: (val) => {
        let adjustedValue = val
        if (reverseOrder) {
          adjustedValue = endVal - val + startVal
        }

        AnimatedOusdStore.update((s) => {
          s.animatedOusdBalance = adjustedValue
        })
      },
      onCompleteCallback: () => {
        setBalanceEmphasised(false)
        if (addOusdModalState === 'waiting') {
          AccountStore.update((s) => {
            s.addOusdModalState = 'show'
          })
        }
      },
      // non even duration number so more of the decimals in ousdBalance animate
      duration: 1985,
      id: 'header-balance-ousd-animation',
      stepTime: 30,
    })
  }

  useEffect(() => {
    if (ousdBalanceLoaded) {
      const ousdBalanceNum = parseFloat(ousdBalance)
      const prevOusdBalanceNum = parseFloat(prevOusdBalance)
      // user must have minted the OUSD
      if (
        typeof ousdBalanceNum === 'number' &&
        typeof prevOusdBalanceNum === 'number' &&
        Math.abs(ousdBalanceNum - prevOusdBalanceNum) > mintAnimationLimit
      ) {
        normalOusdAnimation(prevOusdBalance, ousdBalance)
      } else if (
        typeof ousdBalanceNum === 'number' &&
        ousdBalanceNum > mintAnimationLimit
      ) {
        normalOusdAnimation(0, ousdBalance)
      }
    }
  }, [ousdBalance])

  const displayedBalance = formatCurrency(animatedOusdBalance || 0, 6)
  return (
    <>
      <div className="balance-header d-flex justify-content-start align-items-center">
        <div className="apy-container d-flex align-items-center justify-content-center flex-column">
          <div className="contents d-flex flex-column">
            <div className="light-grey-label apy-label">Trailing APY</div>
            <div className="apy-percentage">
              {typeof apy === 'number' ? formatCurrency(apy * 100, 2) : 0}
            </div>
            <a
              href="https://analytics.ousd.com/apr"
              target="_blank"
              className="detail"
            >
              {fbt('Learn more', 'Learn more ')}&nbsp;&gt;
            </a>
          </div>
        </div>
        <div className="ousd-value-holder d-flex flex-column align-items-start justify-content-center">
          <div className="light-grey-label d-flex">
            {fbt('OUSD Balance', 'OUSD Balance')}
          </div>
          <div className={`ousd-value ${balanceEmphasised ? 'big' : ''}`}>
            {typeof parseFloat(displayedBalance) === 'number' &&
            animatedOusdBalanceLoaded ? (
              <>
                {' '}
                {displayedBalance.substring(0, displayedBalance.length - 4)}
                <span className="grey">
                  {displayedBalance.substring(displayedBalance.length - 4)}
                </span>
              </>
            ) : (
              '0'
            )}
          </div>
          <div className="expected-increase d-flex flex-row align-items-center justify-content-center">
            <p>
              {fbt('Next expected increase', 'Next expected increase')}:{' '}
              <strong>{animatedExpectedIncrease}</strong>
            </p>
            <DisclaimerTooltip
              id="howBalanceCalculatedPopover"
              isOpen={calculateDropdownOpen}
              smallIcon
              handleClick={(e) => {
                e.preventDefault()

                setCalculateDropdownOpen(!calculateDropdownOpen)
              }}
              handleClose={() => setCalculateDropdownOpen(false)}
              text={fbt(
                `Your OUSD balance will increase when the next rebase event occurs. This amount is not guaranteed but it reflects the increase that would occur if rebase were to occur right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`,
                `Your OUSD balance will increase when the next rebase event occurs. This amount is not guaranteed but it reflects the increase that would occur if rebase were to occur right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`
              )}
            />
          </div>
        </div>
      </div>
      <style jsx>{`
        .balance-header {
          min-height: 200px;
        }

        .balance-header .light-grey-label {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: -3px;
        }

        .balance-header .detail {
          font-size: 12px;
          color: #8293a4;
        }

        .balance-header a:hover {
          color: #183140;
        }

        .balance-header .ousd-value {
          font-size: 36px;
          color: #183140;
          transition: font-size 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5),
          color 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5);
          margin-bottom: 5px;
        }

        .balance-header .ousd-value.big {
          color: #00d592;
        }

        .balance-header .ousd-value .grey {
          color: #8293a4;
        }

        .balance-header .ousd-value::after {
          content: '';
          vertical-align: baseline;
          color: #183140;
          font-size: 14px;
          margin-left: 8px;
        }

        .balance-header .apy-container {
          width: 210px;
          height: 100%;
          margin-right: 46px;
          border-right: solid 1px #cdd7e0;
        }

        .balance-header .apy-container .contents {
          z-index: 2;
        }

        .balance-header .apy-container .apy-label {
          margin-bottom: -8px;
        }

        .balance-header .apy-container .apy-percentage {
          font-size: 36px;
          text-align: center;
          color: #183140;
          margin-bottom: 5px;
        }

        .balance-header .apy-container .apy-percentage::after {
          content: '%';
          font-size: 16px;
          font-weight: bold;
          color: #183140;
          vertical-align: super;
          padding-left: 2px;
        }

        .balance-header .expected-increase {
          margin: 0 8px 1px 0;
          font-size: 12px;
          color: #8293a4;
        }

        .balance-header .expected-increase p {
          margin: auto;
        }

        @media (max-width: 799px) {
          .balance-header {
            align-items: center;
            text-align: center;
            padding: 0px 20px;
            min-height: 140px;
          }

          .balance-header .apy-container {
            width: 100px;
            margin-right: 19px;
          }

          .balance-header .gradient-border {
            width: 100px;
            height: 100px;
            margin-right: 20px;
            padding-right: 20px;
          }

          .balance-header .ousd-value {
            font-size: 23px;
            margin-bottom: 0px;
          }

          .balance-header .ousd-value .grey {
            color: #8293a4;
          }

          .balance-header .apy-container .apy-label {
            font-family: Lato;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            color: #8293a4;
          }

          .balance-header .apy-container .apy-percentage {
            font-family: Lato;
            font-size: 23px;
            color: #1e313f;
            font-weight: normal;
          }

          .balance-header .apy-container .apy-percentage::after {
            content: '%';
            font-size: 14px;
            vertical-align: text-top;
          }

          .balance-header .ousd-value::after {
            content: '';
          }

          .balance-header .light-grey-label {
            font-family: Lato;
            font-size: 11px;
            font-weight: bold;
            color: #8293a4;
            margin-bottom: -2px;
          }

          .ousd-value-holder {
            margin-bottom: 5px;
          }
        }
      `}</style>
    </>
  )
}

export default BalanceHeader
