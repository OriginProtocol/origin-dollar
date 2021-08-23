import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'
import { get as _get } from 'lodash'
import { useWeb3React } from '@web3-react/core'

import AccountStore from 'stores/AccountStore'
import AnimatedOusdStore from 'stores/AnimatedOusdStore'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { usePrevious } from 'utils/hooks'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'
import LinkIcon from 'components/buySell/_LinkIcon'
import useExpectedYield from 'utils/useExpectedYield'
import withRpcProvider from 'hoc/withRpcProvider'

const BalanceHeader = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
}) => {
  const { connector, account } = useWeb3React()
  const apy = useStoreState(ContractStore, (s) => s.apy || 0)
  const vault = useStoreState(ContractStore, (s) => _get(s, 'contracts.vault'))
  const ousdContract = useStoreState(ContractStore, (s) =>
    _get(s, 'contracts.ousd')
  )
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const ousdBalanceLoaded = typeof ousdBalance === 'string'
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const mintAnimationLimit = 0.5
  const rebaseOptedOut = useStoreState(AccountStore, (s) =>
    _get(s, 'rebaseOptedOut')
  )

  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const { animatedExpectedIncrease } = useExpectedYield()

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

  const displayedBalance = formatCurrency(animatedOusdBalance || 0, 2)
  return (
    <>
      <div className="balance-header d-flex flex-column justify-content-start">
        <div className="d-flex flex-column flex-md-row balance-holder justify-content-start w-100">
          <div className="apy-container d-flex justify-content-center flex-column">
            <div className="contents d-flex align-items-center justify-content-md-start justify-content-center">
              <div className="light-grey-label apy-label">Trailing APY</div>
              <div className="apy-percentage">
                {typeof apy === 'number'
                  ? formatCurrency(apy * 100, 2)
                  : '--.--'}
              </div>
              <a
                href="https://analytics.ousd.com/apr"
                target="_blank"
                rel="noopener noreferrer"
                className="detail mr-5"
              >
                <span className="pr-2 ml-3">
                  {fbt('Learn more', 'Learn more ')}
                </span>
                <LinkIcon />
              </a>
            </div>
          </div>
          <div className="ousd-value-holder d-flex align-items-center justify-content-md-start justify-content-center mb-2 mb-md-0">
            <div className="light-grey-label d-flex">
              {fbt('OUSD Balance', 'OUSD Balance')}
            </div>
            <div
              className={`ousd-value ${balanceEmphasised ? 'big' : ''} ${
                animatedOusdBalance > 1000000 ? 'mio-club' : ''
              }`}
            >
              {!isNaN(parseFloat(displayedBalance)) && ousdBalanceLoaded
                ? displayedBalance
                : '--.--'}
            </div>
            {rebaseOptedOut ? (
              <p className="mr-2">
                <>{fbt('Opted out of rebasing', 'Opted out of rebasing')}</>
              </p>
            ) : (
              <div className="expected-increase d-flex align-items-md-center align-items-start justify-content-center">
                <p className="mr-2">
                  {fbt('Next expected increase', 'Next expected increase')}:{' '}
                  <strong>{formatCurrency(animatedExpectedIncrease, 2)}</strong>
                </p>
              </div>
            )}
          </div>
          {!rebaseOptedOut && (
            <div className="expected-increase d-flex align-items-md-center align-items-start justify-content-center mb-2 mb-md-0">
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
                  smallIcon
                  text={fbt(
                    `Your OUSD balance will increase automatically when the next rebase event occurs. This number is not guaranteed but it reflects the increase that would occur if rebase were to happen right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`,
                    `Your OUSD balance will increase automatically when the next rebase event occurs. This number is not guaranteed but it reflects the increase that would occur if rebase were to happen right now. The expected amount may decrease between rebases, but your actual OUSD balance should never go down.`
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .balance-header {
          padding: 0 0 19px 40px;
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
        }

        .balance-header .detail {
          font-size: 12px;
          color: #8293a4;
        }

        .balance-header a:hover {
          color: white;
        }

        .balance-header .ousd-value {
          font-size: 14px;
          color: white;
          text-align: left;
          text-overflow: ellipsis;
          transition: font-size 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5),
            color 0.2s cubic-bezier(0.5, -0.5, 0.5, 1.5);
          position: relative;
          margin-left: 11px;
        }

        .balance-header .ousd-value.big {
          color: #00d592;
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
        }

        .balance-header .apy-container .contents {
          z-index: 2;
        }

        .balance-header .apy-container .apy-percentage {
          font-size: 14px;
          color: #ffffff;
          font-weight: bold;
          margin-left: 8px;
        }

        .balance-header .apy-container .apy-percentage::after {
          content: '%';
          font-weight: bold;
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

        .balance-header .expected-increase .collect {
          color: #1a82ff;
          cursor: pointer;
        }

        @media (max-width: 799px) {
          .balance-header {
            align-items: center;
            text-align: center;
            padding: 0px 20px;
            min-height: 80px;
          }

          .apy-container {
            margin-bottom: 10px;
          }

          .balance-header .gradient-border {
            width: 100px;
            height: 100px;
            margin-right: 20px;
            padding-right: 20px;
          }

          .balance-header .ousd-value.mio-club {
            font-size: 20px;
          }

          .balance-header .ousd-value .grey {
            color: #8293a4;
          }

          .balance-header .ousd-value-holder {
            white-space: nowrap;
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
            font-weight: normal;
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
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(BalanceHeader)
