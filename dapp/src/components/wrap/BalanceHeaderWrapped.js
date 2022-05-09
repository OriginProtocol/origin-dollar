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
import { adjustLinkHref } from 'utils/utils'
import Dropdown from 'components/Dropdown'
import DownCaret from 'components/DownCaret'
import { zipObject } from 'lodash'

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

  const wousdBalance = useStoreState(AccountStore, (s) => s.balances['wousd'])
  const wousdBalanceLoaded = typeof wousdBalance === 'string'
  const wousdValue = useStoreState(AccountStore, (s) => s.wousdValue)

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
        <div
          className={`d-flex holder flex-row flex-md-column align-items-end align-items-md-start justify-content-start ${
            marginBottom ? 'margin-bottom' : ''
          }`}
        >
          <div className={`value ${type}`}>{value}</div>
          <div className="flex-row">
            <span className="dropdown">{dropdown}</span>
            {titleLink && (
              <a
                className={`title link ${type}`}
                href={adjustLinkHref(titleLink)}
                rel="noopener noreferrer"
                target="blank"
              >
                {title}
              </a>
            )}
            {!titleLink && <div className="title">{title}</div>}
          </div>
        </div>
        <style jsx>{`
          .dropdown {
            display: inline-block;
          }

          .title {
            color: #8293a4;
            font-size: 14px;
            display: inline;
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
              width: 55%;
              text-align: left;
              margin-bottom: 3px;
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
              color: white;
              font-size: 20px;
              width: 45%;
              text-align: left;
            }

            .margin-bottom {
              margin-bottom: 20px;
            }
          }
        `}</style>
      </>
    )
  }

  const displayedWousdBalance = formatCurrency(wousdBalance || 0, 2)

  useEffect(() => {
    localStorage.setItem('last_user_selected_apy', apyDays)
  }, [apyDays])

  const ApySelect = () => {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Dropdown
          content={
            <div className="dropdown-menu d-flex flex-column">
              {apyDayOptions.map((days) => {
                return (
                  <div
                    key={days}
                    className="dropdown-item justify-content-start align-items-center"
                    onClick={() => {
                      setApyDays(days)
                      setOpen(false)
                    }}
                  >
                    {`${days}d`}
                  </div>
                )
              })}
            </div>
          }
          open={open}
          onClose={() => setOpen(false)}
        >
          <div
            className="apy-select d-flex flex-row align-items-center"
            onClick={() => setOpen(!open)}
          >
            {`${apyDays}d`}
            <span className="downcaret">
              <DownCaret color="black" size="26" />
            </span>
          </div>
        </Dropdown>
        <style jsx>{`
          .apy-select {
            background-color: white;
            font-size: 16px;
            font-weight: 500;
            color: black;
            width: 68px;
            height: 25px;
            padding: 0 22px 2px 8px;
            margin-right: 8px;
            border-radius: 20px;
            cursor: pointer;
          }

          .apy-select:hover {
            background-color: #f2f3f5;
          }

          .dropdown-menu {
            margin-right: 200px;
            background-color: white;
            font-size: 16px;
            color: black;
            min-width: 90px;
            top: 100%;
            left: 0;
            padding: 5px;
          }

          .dropdown-item {
            background-color: white;
            color: black;
            padding: 3px 5px 3px 10px;
            line-height: 20px;
            cursor: pointer;
          }

          .dropdown-item:hover {
            background-color: #f2f3f5;
          }

          .downcaret {
            position: absolute;
            left: 42px;
          }
        `}</style>
      </>
    )
  }

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
                dropdown={<ApySelect />}
                title={fbt('Trailing APY', 'Trailing APY')}
                titleLink="https://analytics.ousd.com/apy"
                value={
                  typeof daysToApy[apyDays] === 'number'
                    ? formatCurrency(daysToApy[apyDays] * 100, 2)
                    : '--.--'
                }
                type={
                  typeof daysToApy[apyDays] === 'number' ? 'percentage' : ''
                }
              />
            </div>
          </div>
          <div className="d-flex flex-column flex-md-row align-items-center justify-content-between box box-narrow w-100">
            <Statistic
              title={fbt('wOUSD Balance', 'wOUSD Balance')}
              value={
                !isNaN(parseFloat(displayedWousdBalance)) && wousdBalanceLoaded
                  ? displayedWousdBalance
                  : '--.--'
              }
              type={'number'}
              marginBottom={true}
            />
            <Statistic
              title={fbt('Current Value (OUSD)', 'Current Value (OUSD)')}
              value={
                walletConnected && !isNaN(wousdValue)
                  ? formatCurrency(wousdValue, 2)
                  : '--.--'
              }
              type={'number'}
              marginBottom={true}
            />
            <Statistic
              title={fbt('Pending yield (OUSD)', 'Pending yield (OUSD)')}
              value={
                walletConnected
                  ? formatCurrency(animatedExpectedIncrease, 2)
                  : '--.--'
              }
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

        .box-narrow {
          padding: 30px 50px;
        }

        .box.box-black {
          background-color: black;
          margin-right: 10px;
          min-width: 230px;
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

          .box.box-black {
            min-width: 100%;
            margin-right: 0px;
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

export default withIsMobile(withRpcProvider(BalanceHeaderWrapped))
