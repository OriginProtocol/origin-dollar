import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { PieChart } from 'react-minimal-pie-chart'
import { formatCurrency } from '../utils/math'
import { tokenColors } from 'utils/constants'

const Collateral = ({ collateral, allocation }) => {
  // temporary calculation, waiting for metastrategy integration into analytics
  //const meta = allocation?.strategies && allocation.strategies[4].ousd
  const meta = allocation.strategies?.find((s) => {
    return s.name === 'OUSD MetaStrategy'
  }).ousd

  const total =
    collateral.collateral?.reduce((t, s) => {
      return {
        total: Number(t.total) + Number(s.name === 'ousd' ? 0 : s.total),
      }
    }).total - meta

  const chartData = collateral.collateral?.map((token) => {
    return {
      title: token.name.toUpperCase(),
      value: total
        ? (token.name === 'ousd' ? 0 : (token.total - meta / 3) / total) * 100
        : 0,
      color: tokenColors[token.name] || '#ff0000',
    }
  })

  return (
    <>
      <section className="dim">
        <div className="py-[120px] px-[16px] md:px-[134px] text-center">
          <Typography.H6
            className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
            style={{ fontWeight: 700 }}
          >
            {fbt('Always 100% collateralized', 'Always 100% collateralized')}
          </Typography.H6>
          <Typography.Body3 className="md:max-w-[943px] mt-[16px] mx-auto text-[#b5beca]">
            {fbt(
              'OUSD is backed 1:1 by the most trusted collateral in crypto. Reserves are verifiable on-chain. You can redeem OUSD immediately at any time.',
              'OUSD is backed 1:1 by the most trusted collateral in crypto. Reserves are verifiable on-chain. You can redeem OUSD immediately at any time.'
            )}
          </Typography.Body3>
          <div className="max-w-[1432px] mx-auto flex flex-col md:flex-row justify-between mt-20 mb-16 px-8 xl:px-[132px] py-6 xl:py-20 rounded-xl bg-[#141519]">
            <Typography.H7 className="font-bold md:hidden">
              {fbt('Currently-held collateral', 'Currently-held collateral')}
            </Typography.H7>
            <div className="relative w-full sm:w-1/2 mt-6 md:mt-0 mx-auto">
              <PieChart data={chartData} lineWidth={6} startAngle={270} />
              <Typography.H6 className="absolute font-bold text-3xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{`$${formatCurrency(
                total,
                0
              )}`}</Typography.H6>
            </div>
            <div className="md:w-1/2 md:ml-10 xl:ml-32 mt-6 md:mt-0 pl-0 md:py-10 text-left">
              <Typography.H7 className="mb-3 font-bold hidden md:block">
                {fbt('Currently-held collateral', 'Currently-held collateral')}
              </Typography.H7>
              <div className="flex flex-wrap md:mt-12 md:flex-col justify-between h-4/5">
                {collateral.collateral?.map((token) => {
                  if (token.name === 'ousd') return
                  const realTotal = token.total - meta / 3
                  return (
                    <div
                      className="flex flex-row my-[2px] md:my-0"
                      key={token.name}
                    >
                      <img
                        src={assetRootPath(`/images/${token.name}-logo.svg`)}
                        className="w-12 md:w-[72px]"
                      ></img>
                      <div className="ml-[8px] md:ml-8">
                        <Typography.H7 className="text-base md:text-[32px] font-bold">
                          {`${formatCurrency((realTotal / total) * 100, 2)}%`}
                        </Typography.H7>
                        <Typography.H7
                          className="mt-[0px] md:mt-[8px] text-[12px] md:text-[24px] text-[#b5beca]"
                          style={{ fontWeight: 400 }}
                        >
                          {`$${formatCurrency(realTotal, 0)}`}
                        </Typography.H7>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <a
            href="https://docs.ousd.com/how-it-works"
            target="_blank"
            rel="noopener noreferrer"
            className="bttn gradient2"
          >
            <Typography.H7 className="font-normal">
              {fbt('See how it works', 'See how it works')}
            </Typography.H7>
          </a>
        </div>
      </section>
    </>
  )
}

export default Collateral
