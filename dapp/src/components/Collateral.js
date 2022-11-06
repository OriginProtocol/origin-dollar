import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { PieChart } from 'react-minimal-pie-chart'
import { formatCurrency } from '../utils/math'
import useCollateralQuery from '../queries/useCollateralQuery'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { tokenColors } from 'utils/constants'

const Collateral = () => {
  const collateral = useStoreState(ContractStore, (s) => {
    return s.collateral || {}
  })

  const collateralQuery = useCollateralQuery({
    onSuccess: (collateral) => {
      ContractStore.update((s) => {
        s.collateral = collateral
      })
    },
  })

  useEffect(() => {
    collateralQuery.refetch()
  }, [])

  const total = collateral.collateral?.reduce((t, s) => {
    return { total: Number(t.total) + Number(s.total) }
  }).total

  const chartData = collateral.collateral?.map((token) => {
    return {
      title: token.name.toUpperCase(),
      value: (token.total / total) * 100,
      color: tokenColors[token.name] || '#ff0000',
    }
  })

  return (
    <>
      <section className="home dim m-0">
        <div className="max-w-screen-xl mx-auto pb-20 px-8 text-center">
          <Typography.H3 className="font-bold">
            {fbt('Always 100% collateralized', 'Always 100% collateralized')}
          </Typography.H3>
          <br className="block" />
          <Typography.Body3 className="text-[#b5beca]">
            {fbt(
              'OUSD is backed 1:1 by the most trusted collateral in crypto. Reserves are verifiable on-chain. You can redeem OUSD',
              'OUSD is backed 1:1 by the most trusted collateral in crypto. Reserves are verifiable on-chain. You can redeem OUSD'
            )}{' '}
            <br className="hidden md:block" />
            {fbt('immediately at any time.', 'immediately at any time.')}
          </Typography.Body3>
          <div className="collateral flex flex-col md:flex-row justify-between rounded-xl my-10 md:m-16 px-6 pb-6 md:p-6 lg:px-28 md:py-20">
            <div className="relative h-96">
              <PieChart data={chartData} lineWidth={6} startAngle={270} />
              <Typography.H6 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{`$${'40,123,456'}`}</Typography.H6>
            </div>
            <div className="lg:w-1/2 md:px-20 text-left">
              <Typography.Body className="mb-3">
                {fbt('Currently-held collateral', 'Currently-held collateral')}
              </Typography.Body>
              <br className="hidden md:block" />
              <div className="flex flex-col justify-between h-4/5">
                {collateral.collateral?.map((token) => {
                  return (
                    <div
                      className="flex flex-row my-2 md:my-0"
                      key={token.name}
                    >
                      <img
                        src={assetRootPath(`/images/${token.name}-logo.svg`)}
                        className="pr-6"
                      ></img>
                      <div>
                        <Typography.H6>{`${formatCurrency(
                          (token.total / total) * 100,
                          2
                        )}%`}</Typography.H6>
                        <div className="pt-2">
                          <Typography.Body3 className="text-[#b5beca] pr-2">{`$${formatCurrency(
                            token.total,
                            0
                          )}`}</Typography.Body3>
                        </div>
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
            {fbt('See how it works', 'See how it works')}
          </a>
        </div>
      </section>
      <style jsx>{`
        .collateral {
          background-color: #141519;
        }
      `}</style>
    </>
  )
}

export default Collateral
