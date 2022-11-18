import React, { useState, useEffect, useMemo } from 'react'
import { fbt } from 'fbt-runtime'
import moment from 'moment'
import Link from 'next/link'
import { Chart as ChartJS } from 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
import LineChart from '../components/Chart'
import { Typography } from '@originprotocol/origin-storybook'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { DEFAULT_SELECTED_APY } from 'utils/constants'
import { zipObject } from 'lodash'
import { formatCurrency } from 'utils/math'
import { adjustLinkHref } from 'utils/utils'
import useApyHistoryQuery from '../queries/useApyhistoryQuery'

const Apy = ({ apy }) => {
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

  const apyHistoryQuery = useApyHistoryQuery(apy)

  const apyHistory = useMemo(
    () => apyHistoryQuery.data,
    [apyHistoryQuery.isSuccess, apyHistoryQuery.data]
  )

  const [chartData, setChartData] = useState()
  const dataReversed =
    apyHistory && apyHistory[`apy${apyDays}`] ? apyHistory[`apy${apyDays}`] : []
  const data = dataReversed.slice().reverse()

  useEffect(() => {
    apyHistoryQuery.refetch()
  }, [])

  useEffect(() => {
    localStorage.setItem('last_user_selected_apy', apyDays)
    setLoaded(true)
  }, [apyDays])

  let width, height, gradient
  function getGradient(ctx, chartArea) {
    const chartWidth = chartArea.right - chartArea.left
    const chartHeight = chartArea.bottom - chartArea.top
    if (!gradient || width !== chartWidth || height !== chartHeight) {
      width = chartWidth
      height = chartHeight
      gradient = ctx.createLinearGradient(0, chartArea.left, chartArea.right, 0)
      gradient.addColorStop(0, '#8c66fc')
      gradient.addColorStop(1, '#0274f1')
    }

    return gradient
  }

  useEffect(() => {
    if (data.length === 0) return
    else {
      setChartData({
        label: 'APY',
        labels: data.map((d, i) => moment(d.day).format('MMM Do')),
        datasets: [
          {
            data: data.map((d) => d.trailing_apy),
            borderColor: function (context) {
              const chart = context.chart
              const { ctx, chartArea } = chart

              if (!chartArea) {
                return
              }
              return getGradient(ctx, chartArea)
            },
            borderWidth: 5,
            tension: 0,
            borderJoinStyle: 'round',
            pointRadius: 0,
            pointHitRadius: 1,
          },
        ],
      })
    }
  }, [apyHistory, apyDays])

  return (
    <>
      <section className="home dim">
        <div className="py-[120px] px-[16px] md:px-[134px] text-center">
          <Typography.H6
            className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
            style={{ fontWeight: 700 }}
          >
            {fbt('The simplest', 'The simplest')}{' '}
            <span className="text-gradient2 py-1">
              {fbt('market-neutral', 'market-neutral')}{' '}
            </span>
            {fbt('DeFi strategy', 'DeFi strategy')}
          </Typography.H6>
          <Typography.Body3 className="md:max-w-[943px] mt-[16px] mx-auto text-[#b5beca]">
            {fbt(
              'Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to OUSD. Yields are generated on-chain, distributed directly to your wallet, and compounded automatically. Your funds are never risked on speculative positions.',
              'Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to OUSD. Yields are generated on-chain, distributed directly to your wallet, and compounded automatically. Your funds are never risked on speculative positions.'
            )}
          </Typography.Body3>
          {loaded && (
            <div className="max-w-[1432px] mx-auto flex flex-col mt-20 mb-16 p-[16px] md:p-10 rounded-xl bg-[#141519]">
              <div className="flex flex-col lg:flex-row justify-between">
                <div className="mt-[0px] md:mt-[16px]">
                  <Typography.H2 className="font-bold xl:inline md:text-left">
                    {formatCurrency(daysToApy[apyDays] * 100, 2) + '% '}
                  </Typography.H2>
                  <Typography.H7 className="text-base font-normal md:text-2xl text-[#b5beca] mt-[4px] xl:mt-0 xl:inline lg:text-left opacity-70">{`Trailing ${apyDays}-day APY`}</Typography.H7>
                </div>
                <div className="flex flex-col w-[286px] sm:w-[425px] mt-6 lg:mt-0 mx-[auto] lg:mx-0">
                  <Typography.Body3 className="text-[#b5beca]">
                    {fbt('Moving average', 'Moving average')}
                  </Typography.Body3>
                  <div className="flex flex-row justify-between mt-[12px]">
                    {apyDayOptions.map((days) => {
                      return (
                        <div
                          className={`${
                            apyDays === days ? 'gradient2' : 'bg-[#1e1f25]'
                          } w-[90px] sm:w-[135px] p-px rounded-lg text-center cursor-pointer hover:opacity-90`}
                          key={days}
                          onClick={() => {
                            setApyDays(days)
                          }}
                        >
                          <div className="bg-[#1e1f25] w-full h-full rounded-lg">
                            <div
                              className={`w-full h-full py-[14px] rounded-lg ${
                                apyDays === days
                                  ? 'gradient4'
                                  : 'text-[#b5beca]'
                              }`}
                            >
                              <Typography.Body3
                                className={`${
                                  apyDays === days
                                    ? 'text-[#fafbfb] font-medium'
                                    : 'text-[#b5beca]'
                                }`}
                              >{`${days}-day`}</Typography.Body3>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              {chartData && (
                <div className="mt-12 -mr-[16px] -ml-[16px] md:ml-[0px]">
                  <LineChart chartData={chartData} />
                </div>
              )}
            </div>
          )}
          <Link href={adjustLinkHref('/swap')}>
            <a target="_blank" className="bttn gradient2">
              <Typography.H7 className="font-normal">
                {fbt('Start earning now', 'Start earning now')}
              </Typography.H7>
            </a>
          </Link>
        </div>
      </section>
    </>
  )
}

export default Apy
