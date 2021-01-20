import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'
import { get as _get } from 'lodash'

import AccountStore from 'stores/AccountStore'
import AnimatedOusdStore from 'stores/AnimatedOusdStore'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'
import useCompensation from 'hooks/useCompensation'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import useExpectedYield from 'utils/useExpectedYield'
import withRpcProvider from 'hoc/withRpcProvider'

const BalanceHeader = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
}) => {
  const apy = useStoreState(ContractStore, (s) => s.apy || 0)
  const vault = useStoreState(ContractStore, (s) => _get(s, 'contracts.vault'))
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const ousdBalanceLoaded = typeof ousdBalance === 'string'
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const mintAnimationLimit = 0.5
  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)
  const [calculateDropdownOpen, setCalculateDropdownOpen] = useState(false)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const { animatedExpectedIncrease } = useExpectedYield()
  const {
    ousdClaimed,
    ognClaimed,
    ognCompensationAmount,
    remainingOUSDCompensation,
  } = useCompensation()
  const compensationClaimable =
    (ognCompensationAmount > 0 && ognClaimed === false) ||
    (remainingOUSDCompensation > 0 && ousdClaimed === false)

  const handleRebase = async () => {
    try {
      const result = await vault.rebase()
      storeTransaction(result, `rebase`, 'ousd', {})
      const receipt = await rpcProvider.waitForTransaction(result.hash)
    } catch (e) {
      // 4001 code happens when a user rejects the transaction
      if (e.code !== 4001) {
        storeTransactionError(`rebase`, 'ousd')
      }
      console.error('Error OUSD REBASE: ', e)
    }
  }

  const normalOusdAnimation = (from, to) => {
    setBalanceEmphasised(true)
    return animateValue({
      from: parseFloat(from) || 0,
      to: parseFloat(to),
      callbackValue: (val) => {
        AnimatedOusdStore.update((s) => {
          s.animatedOusdBalance = val
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
        !isNaN(parseFloat(ousdBalanceNum)) &&
        !isNaN(parseFloat(prevOusdBalanceNum)) &&
        Math.abs(ousdBalanceNum - prevOusdBalanceNum) > mintAnimationLimit
      ) {
        normalOusdAnimation(prevOusdBalance, ousdBalance)
      } else if (
        !isNaN(parseFloat(ousdBalanceNum)) &&
        ousdBalanceNum > mintAnimationLimit
      ) {
        normalOusdAnimation(0, ousdBalance)
      } else {
        normalOusdAnimation(prevOusdBalance, 0)
      }
    }
  }, [ousdBalance])

  const displayedBalance = formatCurrency(animatedOusdBalance || 0, 6)
  return (
    <>
      <div className="balance-header d-flex flex-column justify-content-start">
        <div className="d-flex balance-holder justify-content-start w-100">
          <div className="apy-container d-flex justify-content-center flex-column">
            <div className="contents d-flex flex-column align-items-start justify-content-center">
              <div className="light-grey-label apy-label">Trailing APY</div>
              <div className="apy-percentage">
                {typeof apy === 'number'
                  ? formatCurrency(apy * 100, 2)
                  : '--.--'}
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
            <div
              className={`ousd-value ${balanceEmphasised ? 'big' : ''} ${
                animatedOusdBalance > 1000000 ? 'mio-club' : ''
              }`}
            >
              {!isNaN(parseFloat(displayedBalance)) && ousdBalanceLoaded ? (
                <>
                  {' '}
                  {displayedBalance.substring(0, displayedBalance.length - 4)}
                  <span className="grey">
                    {displayedBalance.substring(displayedBalance.length - 4)}
                  </span>
                </>
              ) : (
                '--.----'
              )}
              {compensationClaimable && (
                <Link href="/compensation">
                  <a className="claimable-compensation">
                    <div className="arrow"></div>
                    <div className="yellow-box d-flex justify-content-between">
                      <div className="compensation">
                        {fbt(
                          'Claim your compensation',
                          'Claim your compensation call to action'
                        )}
                      </div>
                      <div>&gt;</div>
                    </div>
                  </a>
                </Link>
              )}
            </div>
            <div className="expected-increase d-flex flex-sm-row flex-column align-items-md-center align-items-start justify-content-center">
              <p className="mr-2">
                {fbt('Next expected increase', 'Next expected increase')}:{' '}
                <strong>{formatCurrency(animatedExpectedIncrease, 2)}</strong>
              </p>
              <div className="d-flex">
                {vault && parseFloat(ousdBalance) > 0 ? (
                  <p
                    onClick={async () => await handleRebase()}
                    className="collect mr-2"
                  >
                    {fbt('Collect now', 'Collect now')}
                    {}
                  </p>
                ) : (
                  <></>
                )}
                <DisclaimerTooltip
                  id="howBalanceCalculatedPopover"
                  className="align-items-center"
                  isOpen={calculateDropdownOpen}
                  smallIcon
                  handleClick={(e) => {
                    e.preventDefault()
                    setCalculateDropdownOpen(!calculateDropdownOpen)
                  }}
                  handleClose={() => setCalculateDropdownOpen(false)}
                  text={fbt(
                    `Your OUSD balance will increase automatically when the next rebase event occurs. This number is not guaranteed but it reflects the increase that would occur if rebase were to happen right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`,
                    `Your OUSD balance will increase automatically when the next rebase event occurs. This number is not guaranteed but it reflects the increase that would occur if rebase were to happen right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .balance-header {
          padding: 0px 40px;
        }

        .balance-header .inaccurate-balance {
          border: 2px solid #ed2a28;
          border-radius: 5px;
          color: #ed2a28;
          margin-bottom: 40px;
          padding: 15px;
        }

        .balance-header .inaccurate-balance a {
          text-decoration: underline;
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
          text-align: left;
          text-overflow: ellipsis;
          width: 100%;
          transition: font-size 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5),
            color 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5);
          margin-bottom: 5px;
          position: relative;
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
          height: 100%;
          margin-right: 40px;
          padding-right: 40px;
          border-right: solid 1px #cdd7e0;
        }

        .balance-header .apy-container .contents {
          z-index: 2;
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
          font-size: 12px;
          color: #8293a4;
        }

        .balance-header .expected-increase p {
          margin: auto;
        }

        .balance-header .expected-increase .dropdown {
          justify-content: center !important;
        }

        .balance-header .expected-increase .dropdown .disclaimer-tooltip {
          display: flex !important;
        }

        .claimable-compensation {
          position: absolute;
          top: 10px;
          right: -236px;
          z-index: 2;
        }

        .claimable-compensation .yellow-box {
          padding: 5px 6px 8px 14px;
          box-shadow: 0 0 14px 0 #cdd7e0;
          border: solid 2px #fec100;
          background-color: #fff9ea;
          font-size: 14px;
          font-weight: bold;
          color: black;
          white-space: nowrap;
          border-radius: 5px;
        }

        .claimable-compensation .arrow {
          position: absolute;
          top: 0px;
          bottom: 0px;
          margin: auto;
          left: -5px;
          width: 12px;
          height: 12px;
          background-color: #fff9ea;
          transform: rotate(45deg);
          border-width: 0px 0px 2px 2px;
          border-style: solid;
          border-color: #fec100;
        }

        .claimable-compensation .yellow-box .compensation {
          margin-right: 40px;
        }

        .balance-header .expected-increase .collect {
          color: #1a82ff;
          cursor: pointer;
        }

        .balance-header .ousd-value-holder {
          padding: 50px 0px;
        }

        @media (max-width: 799px) {
          .balance-header {
            align-items: center;
            text-align: center;
            padding: 0px 20px;
            min-height: 140px;
          }

          .balance-header .apy-container {
            margin-right: 20px;
            padding-right: 20px;
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

          .balance-header .ousd-value.mio-club {
            font-size: 20px;
          }

          .balance-header .ousd-value .grey {
            color: #8293a4;
          }

          .balance-header .ousd-value-holder {
            white-space: nowrap;
            padding: 25px 0px;
            margin-bottom: 5px;
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

          .balance-holder {
            width: 100%;
          }

          .ousd-value-holder {
            margin-bottom: 5px;
          }

          .claimable-compensation {
            top: 50px;
            left: -60px;
            right: auto;
          }

          .claimable-compensation .arrow {
            top: -5px;
            bottom: auto;
            left: 0px;
            right: 0px;
            border-width: 2px 0px 0px 2px;
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(BalanceHeader)
