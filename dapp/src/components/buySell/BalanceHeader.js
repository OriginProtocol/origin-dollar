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

const environment = process.env.NODE_ENV

const BalanceHeader = () => {
  const apy = useStoreState(ContractStore, (s) => s.apy || 0)
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const ousdBalanceLoaded = typeof ousdBalance === 'string'
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const animatedOusdBalanceLoaded = typeof animatedOusdBalance === 'number'
  const runForHours = 24
  const mintAnimationLimit = 0.5
  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)
  const [calculateDropdownOpen, setCalculateDropdownOpen] = useState(false)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )

  const normalOusdAnimation = (fromOusdBalance) => {
    let timeSinceLastAnimationStorage
    return animateValue({
      from: parseFloat(fromOusdBalance),
      to:
        parseFloat(fromOusdBalance) +
        (parseFloat(fromOusdBalance) * (apy || 0)) / (8760 / runForHours), // 8760 hours within a calendar year
      callbackValue: (value) => {
        // store the animated balance to local storage
        const storeAnimatedValueState = (animatedOusdBalance) => {
          if (!animatedOusdBalance || !ousdBalance) {
            return
          }

          localStorage.setItem(
            'animatedBalance',
            JSON.stringify({
              animatedOusdBalance: animatedOusdBalance.toString(),
              ousdBalance: ousdBalance.toString(),
              time: new Date(),
            })
          )
        }

        AnimatedOusdStore.update((s) => {
          s.animatedOusdBalance = value
        })

        if (
          !timeSinceLastAnimationStorage ||
          // store animation data each 5 seconds
          new Date() - timeSinceLastAnimationStorage >= 5000
        ) {
          timeSinceLastAnimationStorage = new Date()
          storeAnimatedValueState(value)
        }
      },
      duration: 3600 * 1000 * runForHours, // animate for {runForHours} hours
      id: 'header-balance-ousd-animation',
      stepTime: 30,
    })
  }

  useEffect(() => {
    if (ousdBalanceLoaded) {
      const ousdBalanceNum = parseFloat(ousdBalance)
      const prevOusdBalanceNum = parseFloat(prevOusdBalance)

      AnimatedOusdStore.update((s) => {
        s.animatedOusdBalance = ousdBalance
      })

      // do it with delay because of the pull state race conditions
      let animateCancel
      const timeout = setTimeout(() => {
        // user must have minted the OUSD
        if (
          typeof ousdBalanceNum === 'number' &&
          typeof prevOusdBalanceNum === 'number' &&
          Math.abs(ousdBalanceNum - prevOusdBalanceNum) > mintAnimationLimit
        ) {
          setBalanceEmphasised(true)

          const animAmount = parseFloat(prevOusdBalanceNum)
          const newAmount = parseFloat(ousdBalanceNum)

          let startVal = animAmount || 0
          let endVal = newAmount

          const reverseOrder = animAmount > newAmount

          if (reverseOrder) {
            endVal = animAmount
            startVal = newAmount
          }

          animateCancel = animateValue({
            from: startVal,
            to: endVal,
            callbackValue: (val) => {
              let adjustedValue
              if (reverseOrder) {
                adjustedValue = endVal - val + startVal
              } else {
                adjustedValue = val
              }

              AnimatedOusdStore.update((s) => {
                s.animatedOusdBalance = adjustedValue
              })
            },
            onCompleteCallback: () => {
              setBalanceEmphasised(false)
              animateCancel = normalOusdAnimation(ousdBalance)
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
        } else {
          const storedAnimationData = localStorage.getItem('animatedBalance')
          if (storedAnimationData) {
            const animationData = JSON.parse(storedAnimationData)

            /* OUSD balance has not changed, meaning no mint/redeem/transfer/rebase happened
             * from the last time user opened the dapp
             */
            // if (animationData.ousdBalance === ousdBalance) {
            //   // time past since ousd animation last stored in seconds
            //   const timePassed =
            //     (Date.now() - Date.parse(animationData.time)) / 1000

            //   /* increase the animated OUSD according to the apy and the
            //    * time passed since last refresh.
            //    *
            //    * Important (!): this function does not account for APY changing and
            //    * only takes the current APY into the account. Also if rebase happened
            //    * 2 days ago, and user has not opened the app since, the current implementation
            //    * is not able to simulate the balance increase since the rebase, and displays only the
            //    * ousd balance in the amount immediately after rebase.
            //    */
            //   const simulatedOusdBalance =
            //     parseFloat(animationData.animatedOusdBalance) +
            //     ((parseFloat(animationData.animatedOusdBalance) * (apy || 0)) /
            //       // 31536000: amount of seconds in a year
            //       31536000) *
            //       timePassed
            //   animateCancel = normalOusdAnimation(simulatedOusdBalance)
            // } else {
              animateCancel = normalOusdAnimation(ousdBalance)
            // }
          } else {
            animateCancel = normalOusdAnimation(ousdBalance)
          }
        }
      }, 10)

      return () => {
        clearTimeout(timeout)
        if (animateCancel) animateCancel()
      }
    }
  }, [ousdBalance, apy])

  const displayedBalance = formatCurrency(animatedOusdBalance || 0, 6)
  const displayedBalanceNum = parseFloat(displayedBalance)
  return (
    <>
      <div className="balance-header d-flex justify-content-start align-items-center">
        <div className="apy-container d-flex align-items-center justify-content-center flex-column">
          <div className="trailing-border"></div>
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
            {typeof displayedBalanceNum === 'number' &&
            animatedOusdBalanceLoaded ? (
              <>
                {' '}
                {displayedBalance.substring(0, displayedBalance.length - 4)}
              </>
            ) : (
              '0'
            )}
          </div>
          <div className="expected-increase d-flex flex-row align-items-start justify-content-center">
              <p>{fbt('Expected increase', 'Expected increase')}: <strong>7.89</strong></p>
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
                `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vel mauris justo. Vivamus aliquet auctor turpis. Morbi ullamcorper quis libero vitae tincidunt.`,
                `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vel mauris justo. Vivamus aliquet auctor turpis. Morbi ullamcorper quis libero vitae tincidunt`
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
