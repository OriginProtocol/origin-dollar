import React, { useState, useEffect } from 'react'
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
        <div className="pb-20 px-3 md:px-8 text-center">
          <Typography.H4>
            {'The simplest '}
            <span className="gradient-ousd font-bold py-1">
              market-neutral{' '}
            </span>
            DeFi <br className="hidden md:block" />
            strategy
          </Typography.H4>
          <br className="block" />
          <Typography.Body2 className="opacity-75">
            Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to
            OUSD. Yields are generated on-chain, distributed directly{' '}
            <br className="hidden md:block" />
            to your wallet, and compounded automatically. Your funds are never
            risked on speculative positions.
          </Typography.Body2>
          {loaded && (
            <div className="apy flex flex-col md:flex-row justify-between rounded-xl my-10 md:m-16 p-6 md:p-10">
              <div className="mt-2 mb-6 md:mb-0">
                <Typography.H1 className="inline">
                  {formatCurrency(daysToApy[apyDays] * 100, 2) + '% '}
                </Typography.H1>
                <Typography.Body className="opacity-75 block md:inline">{`Trailing ${apyDays}-day APY`}</Typography.Body>
              </div>
              <div className="flex flex-col md:w-2/5">
                <Typography.Body2 className="opacity-75 mb-3">
                  Moving average
                </Typography.Body2>
                <div className="flex flex-row justify-around">
                  {apyDayOptions.map((days) => {
                    return (
                      <div
                        className={`bttn ${
                          apyDays === days ? 'gradient3' : 'bttn-g'
                        } ${isMobile ? 'px-4' : 'px-16'} mb-6 md:mb-1`}
                        key={days}
                        onClick={() => {
                          setApyDays(days)
                        }}
                      >
                        {days}
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
            className="bttn gradient3 white"
          >
            Start earning now
          </a>
        </div>
      </section>
      <style jsx>{`
        .apy {
          background-color: #141519;
        }

        .bttn-g {
          color: #fafbfb;
          background-color: #1e1f25;
        }
      `}</style>
    </>
  )
}

export default withIsMobile(Apy)
