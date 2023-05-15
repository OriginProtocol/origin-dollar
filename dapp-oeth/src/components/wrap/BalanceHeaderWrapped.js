import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { get as _get } from 'lodash'
import withIsMobile from 'hoc/withIsMobile'

import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { apyDayOptions } from 'utils/constants'
import useExpectedYield from 'utils/useExpectedYield'
import withRpcProvider from 'hoc/withRpcProvider'
import ApySelect from 'components/ApySelect'
import { zipObject } from 'lodash'
import { assetRootPath } from 'utils/image'

const BalanceHeaderWrapped = ({
  storeTransaction,
  storeTransactionError,
  rpcProvider,
  isMobile,
}) => {
  const DEFAULT_SELECTED_APY = 365
  const apyOptions = useStoreState(ContractStore, (s) =>
    apyDayOptions.map((d) => {
      return s.apy[`apy${d}`] || 0
    })
  )
  const daysToApy = zipObject(apyDayOptions, apyOptions)
  const [apyDays, setApyDays] = useState(
    process.browser && localStorage.getItem('last_user_selected_apy') !== null
      ? localStorage.getItem('last_user_selected_apy')
      : DEFAULT_SELECTED_APY
  )

  const walletConnected = useStoreState(ContractStore, (s) => s.walletConnected)
  const { animatedExpectedIncrease } = useExpectedYield(true)

  const woethBalance = useStoreState(AccountStore, (s) => s.balances['woeth'])
  const woethBalanceLoaded = typeof woethBalance === 'string'
  const woethValue = useStoreState(AccountStore, (s) => s.woethValue)

  const StatisticPart = ({
    title,
    value,
    type,
    small,
    smallTop,
    marginBottom = false,
  }) => {
    return (
      <>
        <div
          className={`relative contain d-flex flex-row flex-md-column ${
            small ? 'containSmall' : 'containBig'
          } ${smallTop ? 'containSmallTop' : ''} ${marginBottom ? '' : ''}`}
        >
          <div className="title">
            <p className={`${small ? 'small' : 'big'}`}>{title}</p>
          </div>

          <div className="stat">
            <div className={`value d-flex ${type} ${small ? 'small' : 'big'}`}>
              <p>{value}</p>
              {!small && (
                <img
                  src={assetRootPath(`/images/currency/woeth-icon-small.svg`)}
                />
              )}
            </div>
          </div>
        </div>
        <style jsx>{`
          .containSmallTop {
            border-top: 1px solid #141519;
          }

          .containSmall {
            border-left: 1px solid #141519;
            padding: 17px 40px;
          }

          .containBig {
            padding-top: 40px;
            padding-bottom: 40px;
          }

          .inline: {
            display: inline;
          }

          .title {
            color: #828699;
            width: 100%;
          }

          .title p {
            margin-bottom: 0 !important;
          }

          .title .small {
            font-size: 12px;
          }

          .title .big {
            font-size: 16px;
          }

          .value p {
            color: #828699;
            margin-bottom: 0;
          }

          .stat img {
            margin-left: 12px;
          }

          .stat .big {
            font-size: 32px;
          }

          .stat .small {
            font-size: 16px;
          }

          .value.percentage p::after {
            content: '%';
            padding-left: 2px;
          }

          @media (max-width: 767px) {
            .contain {
              width: 100%;
              padding: 16px;
              justify-content: space-between;
              align-items: center;
              border-bottom: 0;
              border-top: 1px solid black;
            }

            .containBig .title {
              color: #fafafb;
            }

            .title {
              width: 55%;
              text-align: left;
            }

            .title.percentage {
              margin-bottom: 10px;
            }

            .holder {
              width: 100%;
            }

            .value.percentage {
              font-size: 32px;
            }

            .value {
              color: #fafbfb;
              font-size: 20px;
              width: 45%;
              text-align: left;
            }

            .stat .value p {
              color: #fafafb;
            }
          }
        `}</style>
      </>
    )
  }

  /*
   * Type: number or percentage
   */
  const Statistic = ({
    dropdown,
    title,
    value,
    type,
    titleLink,
    marginBottom = false,
  }) => {
    return (
      <>
        <div className={`relative stat-contain ${marginBottom ? '' : ''}`}>
          <div className="title">
            <p>{title}</p>
            <span className="dropdown d-md-none">{dropdown}</span>
          </div>

          <div className="stat d-none d-md-block">
            <div className="flex-row">
              <span className="dropdown">{dropdown}</span>
            </div>
            <div className={`value ${type}`}>
              <p>{value}</p>
            </div>
          </div>

          <div className={`value d-md-none ${type}`}>
            <p>{value}</p>
          </div>
        </div>
        <style jsx>{`
          .dropdown {
            display: inline-block;
          }

          .stat-contain {
            display: block;
          }

          .stat {
            padding: 40px;
          }

          .title {
            color: #fafbfb;
            font-size: 14px;
            padding-top: 28px;
            padding-bottom: 28px;
            padding-left: 40px;
            padding-right: 40px;
            border-bottom: 1px solid #141519;
            width: 100%;
          }

          .title p {
            margin-bottom: 0 !important;
          }

          .value p {
            background: -webkit-linear-gradient(
              90deg,
              #b361e6 -28.99%,
              #6a36fc 144.97%
            );
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 32px;
            margin-bottom: 0;
          }

          .value.percentage p::after {
            content: '%';
            padding-left: 2px;
          }

          @media (max-width: 767px) {
            .stat-contain {
              display: flex;
              flex-direction: row;
              justify-content: space-between;
            }

            .title {
              width: 55%;
              text-align: left;
              border-bottom: 0;
              padding: 0;
            }

            .title.percentage {
              margin-bottom: 10px;
            }

            .holder {
              width: 100%;
            }

            .value.percentage {
              font-size: 32px;
            }

            .value {
              color: #fafbfb;
              font-size: 20px;
              text-align: left;
            }
          }
        `}</style>
      </>
    )
  }

  const displayedWoethBalance = formatCurrency(woethBalance || 0, 6)

  useEffect(() => {
    localStorage.setItem('last_user_selected_apy', apyDays)
  }, [apyDays])

  return (
    <>
      <div className="balance-header d-flex flex-column justify-content-start">
        <div className="d-flex flex-column flex-md-row balance-holder justify-content-start w-100">
          <div className="apy-container d-flex justify-content-center">
            <div className={`box box-black ${isMobile ? 'w-50' : ''}`}>
              <Statistic
                dropdown={
                  <ApySelect
                    apyDayOptions={apyDayOptions}
                    apyDays={apyDays}
                    setApyDays={setApyDays}
                  />
                }
                title={fbt('APY', 'APY')}
                titleLink="https://analytics.ousd.com/apy"
                value={
                  typeof daysToApy[apyDays] === 'number'
                    ? formatCurrency(daysToApy[apyDays] * 100, 2)
                    : '0'
                }
                type={
                  typeof daysToApy[apyDays] === 'number' ? 'percentage' : ''
                }
              />
            </div>
          </div>
          <div className="box box-narrow w-100">
            <div className="title d-none d-md-block">
              <p>OETH Portfolio</p>
            </div>
            <div className="d-flex flex-column flex-md-row align-items-center justify-content-between stats">
              <StatisticPart
                title={fbt('wOETH Balance', 'wOETH Balance')}
                value={
                  walletConnected &&
                  !isNaN(parseFloat(displayedWoethBalance)) &&
                  woethBalanceLoaded
                    ? displayedWoethBalance
                    : '0'
                }
                type={'number'}
                marginBottom={true}
                small={false}
              />
              <div className="rightStats">
                <StatisticPart
                  title={fbt('Current Value (OETH)', 'Current Value (OETH)')}
                  value={
                    walletConnected && !isNaN(woethValue)
                      ? formatCurrency(woethValue, 6)
                      : '0'
                  }
                  type={'number'}
                  marginBottom={true}
                  small={true}
                />
                <StatisticPart
                  title={fbt('Pending yield (OETH)', 'Pending yield (OETH)')}
                  value={
                    walletConnected
                      ? formatCurrency(animatedExpectedIncrease, 6)
                      : '0'
                  }
                  type={'number'}
                  o
                  small={true}
                  smallTop={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .rightStats {
          display: flex;
          flex-direction: column;
          justify-content: justify-between;
        }

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
          color: #828699;
        }

        .balance-header .detail {
          font-size: 12px;
          color: #828699;
        }

        .balance-header a:hover {
          color: #fafbfb;
        }

        .balance-header .ousd-value {
          font-size: 14px;
          color: #fafbfb;
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
          color: #828699;
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
          min-width: 210px;
          border-radius: 10px;
          color: #fafbfb;
          background-color: #1e1f25;
        }

        .box-narrow {
        }

        .box.box-black {
          background-color: #1e1f25;
          margin-right: 10px;
          min-width: 230px;
        }

        .box .title {
          border-bottom: 1px solid #141519;
          font-size: 14px;
          padding: 28px 40px;
          width: 100%;
        }

        .box .title p {
          margin-bottom: 0;
        }

        .box .stats {
          padding-left: 40px;
        }

        @media (max-width: 767px) {
          .rightStats {
            width: 100%;
          }

          .box .stats {
            padding-left: 0px;
          }

          .box.box-narrow {
            padding: 0;
          }

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
            padding: 16px;
            border-radius: 4px;
          }

          .box.box-black {
            min-width: 100%;
            margin-right: 0px;
          }

          .balance-header .ousd-value.mio-club {
            font-size: 20px;
          }

          .balance-header .ousd-value .grey {
            color: #828699;
          }

          .balance-header .ousd-value-holder {
            white-space: nowrap;
          }

          .balance-header .apy-container .apy-label {
            font-family: Inter;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            color: #828699;
          }

          .balance-header .apy-container .apy-percentage {
            font-family: Inter;
            font-weight: normal;
          }

          .balance-header .ousd-value::after {
            content: '';
          }

          .balance-header .light-grey-label {
            font-family: Inter;
            font-size: 11px;
            font-weight: bold;
            color: #828699;
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

export default withIsMobile(withRpcProvider(BalanceHeaderWrapped))
