import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'
import { get as _get } from 'lodash'
import { useWeb3React } from '@web3-react/core'
import withIsMobile from 'hoc/withIsMobile'

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
  isMobile,
}) => {
  const { connector, account } = useWeb3React()
  const apy = useStoreState(ContractStore, (s) => s.apy || 0)
  const vault = useStoreState(ContractStore, (s) => _get(s, 'contracts.vault'))
  const ousdContract = useStoreState(ContractStore, (s) =>
    _get(s, 'contracts.ousd')
  )
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const lifetimeYield = useStoreState(AccountStore, (s) => s.lifetimeYield)
  const ousdBalanceLoaded = typeof ousdBalance === 'string'
  const animatedOusdBalance = useStoreState(
    AnimatedOusdStore,
    (s) => s.animatedOusdBalance
  )
  const mintAnimationLimit = 0.5

  const [balanceEmphasised, setBalanceEmphasised] = useState(false)
  const prevOusdBalance = usePrevious(ousdBalance)
  const addOusdModalState = useStoreState(
    AccountStore,
    (s) => s.addOusdModalState
  )
  const { animatedExpectedIncrease } = useExpectedYield()

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

  /*
   * Type: number or percentage
   */
  const Statistic = ({ title, value, type, titleLink }) => {
    return (
      <>
        <div className="d-flex flex-column align-items-start justify-content-start">
          {titleLink && (
            <a
              className="title link"
              href={titleLink}
              rel="noopener noreferrer"
              target="blank"
            >
              {title}
            </a>
          )}
          {!titleLink && <div className="title">{title}</div>}
          <div className={`value ${type}`}>{value}</div>
        </div>
        <style jsx>{`
          .title {
            color: #8293a4;
            font-size: 14px;
            margin-bottom: 10px;
          }
          .title.link {
            cursor: pointer;
            text-decoration: underline;
          }
          .value {
            color: white;
            font-size: 28px;
          }

          .value.percentage::after {
            content: '%';
            padding-left: 2px;
          }

          @media (max-width: 799px) {
            .title {
              margin-bottom: 8px;
            }

            .value {
              color: white;
              font-size: 22px;
            }
          }
        `}</style>
      </>
    )
  }
  const displayedBalance = formatCurrency(animatedOusdBalance || 0, 2)
  return (
    <>
      <div className="balance-header d-flex flex-column justify-content-start">
        <div className="d-flex flex-column flex-md-row balance-holder justify-content-start w-100">
          <div className="apy-container d-flex justify-content-center">
            <div
              className={`contents d-flex align-items-center justify-content-center box box-black ${
                isMobile ? 'w-50' : ''
              }`}
            >
              <Statistic
                title={fbt('30-day trailing APY', '30-day trailing APY')}
                titleLink="https://analytics.ousd.com/apy"
                value={
                  typeof apy === 'number'
                    ? formatCurrency(apy * 100, 2)
                    : '--.--'
                }
                type={typeof apy === 'number' ? 'percentage' : ''}
              />
            </div>
            {isMobile && (
              <div className="d-flex align-items-center justify-content-between box w-50">
                <Statistic
                  title={fbt('Balance', 'OUSD Balance')}
                  value={
                    !isNaN(parseFloat(displayedBalance)) && ousdBalanceLoaded
                      ? displayedBalance
                      : '--.--'
                  }
                  type={'number'}
                />
              </div>
            )}
          </div>
          <div className="d-flex align-items-center justify-content-between box w-100">
            {!isMobile && (
              <Statistic
                title={fbt('Balance', 'OUSD Balance')}
                value={
                  !isNaN(parseFloat(displayedBalance)) && ousdBalanceLoaded
                    ? displayedBalance
                    : '--.--'
                }
                type={'number'}
              />
            )}
            <Statistic
              title={fbt('Next expected increase', 'Next expected increase')}
              value={formatCurrency(animatedExpectedIncrease, 2)}
              type={'number'}
            />
            <Statistic
              title={fbt(
                'Lifetime earnings',
                'Lifetime OUSD balance header earnings'
              )}
              titleLink={
                account
                  ? `${
                      process.env.ANALYTICS_ENDPOINT
                    }/address/${account.toLowerCase()}`
                  : false
              }
              value={lifetimeYield ? formatCurrency(lifetimeYield, 2) : '--.--'}
              type={'number'}
            />
          </div>
        </div>
      </div>
      <style jsx>{`
        .balance-header {
          margin-bottom: 19px;
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

        .box {
          padding: 30px;
          min-width: 210px;
          min-height: 118px;
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px black;
          color: white;
        }

        .box.box-black {
          background-color: black;
          margin-right: 10px;
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

          .box {
            padding: 20px;
            min-width: auto;
            min-height: 90px;
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

export default withIsMobile(withRpcProvider(BalanceHeader))
