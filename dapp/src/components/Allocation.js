import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { LinearProgress } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import useAllocationQuery from '../queries/useAllocationQuery'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'
import { theme } from 'utils/constants'
import withIsMobile from 'hoc/withIsMobile'

const Allocation = ({ isMobile }) => {
  const [open, setOpen] = useState({})

  const allocation = useStoreState(ContractStore, (s) => {
    return s.allocation || {}
  })

  const allocationQuery = useAllocationQuery({
    onSuccess: (allocation) => {
      ContractStore.update((s) => {
        s.allocation = allocation
      })
    },
  })

  useEffect(() => {
    allocationQuery.refetch()
  }, [])

  const total = allocation.strategies?.reduce((t, s) => {
    return { total: Number(t.total) + Number(s.total) }
  }).total

  return (
    <>
      <section className="home black">
        <div className="max-w-screen-xl mx-auto pb-20 px-3 md:px-8 text-center">
          <Typography.H3 className="font-bold">
            {fbt(
              'Fully transparent on the Ethereum',
              'Fully transparent on the Ethereum'
            )}{' '}
            <br className="hidden md:block" />
            {fbt('blockchain', 'blockchain')}
          </Typography.H3>
          <br className="block" />
          <Typography.Body3 className="text-[#b5beca]">
            {fbt(
              'Funds are deployed to automated, on-chain, blue-chip stablecoin strategies. There are no gatekeepers or centralized money managers and governance is entirely decentralized.',
              'Funds are deployed to automated, on-chain, blue-chip stablecoin strategies. There are no gatekeepers or centralized money managers and governance is entirely decentralized.'
            )}
          </Typography.Body3>
          <div className="allocation rounded-xl my-10 md:m-16 p-6 md:p-10 divide-black divide-y-2">
            <Typography.Body className="font-bold pb-8">
              {fbt(
                'Current yield sources & allocations',
                'Current yield sources & allocations'
              )}
            </Typography.Body>
            <div className="flex flex-col pt-3">
              <ThemeProvider theme={theme}>
                <div className="flex flex-col justify-between">
                  {allocation.strategies?.map((strategy) => {
                    if (strategy.name === 'vault') return
                    return (
                      <div
                        className="strategy rounded-xl border-2 my-6 md:m-6 cursor-pointer"
                        key={strategy.name}
                        onClick={(e) => {
                          e.preventDefault()
                          setOpen({
                            ...open,
                            [strategy.name]: !open[strategy.name],
                          })
                        }}
                      >
                        <div className="m-6 xl:m-10 xl:mb-8">
                          <div className="flex flex-row justify-between">
                            <img
                              src={assetRootPath(
                                `/images/${strategy.name}-logo-allocation.svg`
                              )}
                              className={`logo mb-8`}
                            />
                            <div>
                              <Typography.H7 className="inline pr-3">{`${formatCurrency(
                                (strategy.total / total) * 100,
                                2
                              )}%`}</Typography.H7>
                              <img
                                src={assetRootPath(`/images/caret.svg`)}
                                className={`w-4 md:w-6 mb-2 inline ${
                                  open[strategy.name] ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>
                          <LinearProgress
                            variant="determinate"
                            value={Number((strategy.total / total) * 100)}
                            color={`${strategy.name}`}
                            sx={{
                              bgcolor: '#141519',
                              borderRadius: 10,
                              height: 15,
                            }}
                            className="h-2"
                          ></LinearProgress>
                          <div
                            className={`${
                              open[strategy.name] ? '' : 'hidden'
                            } flex flex-col xl:flex-row mt-6 whitespace-nowrap`}
                          >
                            {strategy.name !== 'convex' ? (
                              <>
                                <div className="flex flex-row justify-between md:pr-10 py-1">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}dai.svg`
                                      )}
                                      className="w-8"
                                    />
                                    <Typography.Body3 className="pt-1 px-2 md:mx-1 font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } DAI`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="pt-1 text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.dai / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                                <div className="flex flex-row justify-between md:pr-10 py-1">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}usdc.svg`
                                      )}
                                      className="w-8"
                                    />
                                    <Typography.Body3 className="pt-1 px-2 md:mx-1 font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } USDC`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="pt-1 text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.usdc / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                                <div className="flex flex-row justify-between md:pr-10 py-1">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}usdt.svg`
                                      )}
                                      className="w-8"
                                    />
                                    <Typography.Body3 className="pt-1 px-2 md:mx-1 font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } USDT`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="pt-1 text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.usdt / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-row justify-between md:pr-10 py-1">
                                <div className="flex flex-row">
                                  <img
                                    src={assetRootPath(
                                      `/images/convex-3pool.svg`
                                    )}
                                    className="w-8"
                                  />
                                  <Typography.Body3 className="pt-1 px-2 md:mx-1 font-light">
                                    Convex 3pool
                                  </Typography.Body3>
                                </div>
                                <Typography.Body3 className="pt-1 text-[#b5beca] font-light">{`${formatCurrency(
                                  ((strategy.dai +
                                    strategy.usdc +
                                    strategy.usdt) /
                                    strategy.total) *
                                    100,
                                  2
                                )}%`}</Typography.Body3>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ThemeProvider>
            </div>
          </div>
          <a
            href="https://docs.ousd.com/core-concepts/yield-generation"
            target="_blank"
            rel="noopener noreferrer"
            className="bttn gradient2"
          >
            {fbt('See how yield is generated', 'See how yield is generated')}
          </a>
        </div>
      </section>
      <style jsx>{`
        .allocation {
          background-color: #1e1f25;
        }

        .strategy {
          background-color: #14151980;
          border-color: #141519;
        }

        @media (max-width: 799px) {
          .logo {
            max-width: 50%;
          }
        }
      `}</style>
    </>
  )
}

export default Allocation
