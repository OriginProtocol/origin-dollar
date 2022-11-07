import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { DEFAULT_SELECTED_APY } from 'utils/constants'
import { zipObject } from 'lodash'
import { formatCurrency } from 'utils/math'
import withIsMobile from 'hoc/withIsMobile'

const Apy = ({ isMobile }) => {
  const apyDayOptions = [7, 30, 365]
  const [loaded, setLoaded] = useState()
  const apyOptions = useStoreState(ContractStore, (s) =>
    apyDayOptions.map((d) => {
      return s.apy[`apy${d}`] || 0
    })
  )
  const daysToApy = zipObject(apyDayOptions, apyOptions)
  const [apyDays, setApyDays] = useState(
    process.browser &&
      localStorage.getItem('last_user_selected_apy') !== null &&
      apyDayOptions.includes(
        Number(localStorage.getItem('last_user_selected_apy'))
      )
      ? Number(localStorage.getItem('last_user_selected_apy'))
      : DEFAULT_SELECTED_APY
  )

  useEffect(() => {
    localStorage.setItem('last_user_selected_apy', apyDays)
    setLoaded(true)
  }, [apyDays])

  return (
    <>
      <section className="home dim">
        <div className="max-w-screen-xl mx-auto pb-20 px-4 lg:px-8 text-center">
          <Typography.H3 className="font-bold">
            {fbt('The simplest', 'The simplest')}{' '}
            <span className="text-gradient2 py-1">
              {fbt('market-neutral', 'market-neutral')}{' '}
            </span>
            {fbt('DeFi', 'DeFi')} <br className="hidden lg:block" />
            {fbt('strategy', 'strategy')}
          </Typography.H3>
          <br className="block" />
          <Typography.Body3 className="text-[#b5beca]">
            {fbt(
              'Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to OUSD. Yields are generated on-chain, distributed directly to your wallet, and compounded automatically. Your funds are never risked on speculative positions.',
              'Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to OUSD. Yields are generated on-chain, distributed directly to your wallet, and compounded automatically. Your funds are never risked on speculative positions.'
            )}
          </Typography.Body3>
          {loaded && (
            <div className="apy flex flex-col lg:flex-row justify-between rounded-xl my-10 lg:m-16 p-6 lg:p-10">
              <div className="mt-2 mb-6 lg:mb-0">
                <Typography.H2 className="font-bold lg:inline">
                  {formatCurrency(daysToApy[apyDays] * 100, 2) + '% '}
                </Typography.H2>
                <Typography.Body className="text-[#b5beca] block lg:inline">{`Trailing ${apyDays}-day APY`}</Typography.Body>
              </div>
              <div className="flex flex-col lg:w-2/5">
                <Typography.Body3 className="text-[#b5beca] mb-3">
                  {fbt('Moving average', 'Moving average')}
                </Typography.Body3>
                <div className="flex flex-row justify-around">
                  {apyDayOptions.map((days) => {
                    return (
                      <div
                        className={`${
                          apyDays === days ? 'gradient2' : 'inactive'
                        } days1 w-1/3 mb-6 lg:mb-1 p-px text-center`}
                        key={days}
                        onClick={() => {
                          setApyDays(days)
                        }}
                      >
                        <div
                          className={`${
                            apyDays === days ? 'gradient4' : 'inactive'
                          } days2 w-full h-full`}
                        >
                          {days}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <a
            href="/swap"
            target="_blank"
            rel="noopener noreferrer"
            className="bttn gradient2 white"
          >
            <Typography.H7 className="font-normal">
              {fbt('Start earning now', 'Start earning now')}
            </Typography.H7>
          </a>
        </div>
      </section>
      <style jsx>{`
        .apy {
          background-color: #141519;
        }

        .days1 {
          display: inline-block;
          border-radius: 5px;
          white-space: nowrap;
          margin: 0px 10px 10px 10px;
          text-align: center;
          cursor: pointer;
        }

        .days2 {
          display: inline-block;
          border-radius: 5px;
          white-space: nowrap;
          padding: 12px 0;
          text-align: center;
          cursor: pointer;
        }

        .days1:hover {
          opacity: 0.9;
        }

        .active {
          border: 2px solid #8c66fc;
        }

        .inactive {
          color: #fafbfb;
          background-color: #1e1f25;
        }

        .days {
        }

        @media (max-width: 799px) {
          .days {
            padding-left: 4px;
            padding-right: 4px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(Apy)
