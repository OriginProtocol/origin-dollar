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
      <section className="black">
        <div className="py-[120px] px-[16px] md:px-[134px] text-center">
          <Typography.H6
            className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
            style={{ fontWeight: 700 }}
          >
            {fbt(
              'Fully transparent on the Ethereum blockchain',
              'Fully transparent on the Ethereum blockchain'
            )}
          </Typography.H6>
          <Typography.Body3 className="md:max-w-[943px] mt-[16px] mx-auto text-[#b5beca]">
            {fbt(
              'Funds are deployed to automated, on-chain, blue-chip stablecoin strategies. There are no gatekeepers or centralized money managers and governance is entirely decentralized.',
              'Funds are deployed to automated, on-chain, blue-chip stablecoin strategies. There are no gatekeepers or centralized money managers and governance is entirely decentralized.'
            )}
          </Typography.Body3>
          <div className="allocation mt-20 mb-16 rounded-xl divide-black divide-y-2">
            <Typography.H7 className="font-bold px-[16px] py-[22px] md:p-10">
              {fbt(
                'Current yield sources & allocations',
                'Current yield sources & allocations'
              )}
            </Typography.H7>
            <div className="max-w-[1432px] mx-auto flex flex-col px-[16px] md:px-10 py-[10px] md:py-8">
              <ThemeProvider theme={theme}>
                <div className="flex flex-col justify-between">
                  {allocation.strategies?.map((strategy) => {
                    if (strategy.name === 'vault') return
                    return (
                      <div
                        className="strategy rounded-xl border-2 p-[16px] md:p-8 my-[6px] md:my-[8px] cursor-pointer"
                        key={strategy.name}
                        onClick={(e) => {
                          e.preventDefault()
                          setOpen({
                            ...open,
                            [strategy.name]: !open[strategy.name],
                          })
                        }}
                      >
                        <div>
                          <div className="flex flex-row justify-between">
                            <img
                              src={assetRootPath(
                                `/images/${strategy.name}-logo-allocation.svg`
                              )}
                              className={`logo`}
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
                              height: 4,
                            }}
                            className="mt-[16px]"
                          ></LinearProgress>
                          <Typography.Caption className="mt-[22px] text-[#b5beca] text-left">
                            Interest is earned by borrowers and governance token
                            rewards are harvested for additional yields.
                          </Typography.Caption>
                          <div
                            className={`${
                              open[strategy.name] ? '' : 'hidden'
                            } flex flex-col xl:flex-row mt-[22px] whitespace-nowrap`}
                          >
                            {strategy.name !== 'convex' ? (
                              <>
                                <div className="flex flex-row justify-between md:pr-10">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}dai.svg`
                                      )}
                                      className="w-6"
                                    />
                                    <Typography.Body3 className="pl-[12px] pr-[16px] font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } DAI`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.dai / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                                <div className="flex flex-row justify-between md:pr-10">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}usdc.svg`
                                      )}
                                      className="w-6"
                                    />
                                    <Typography.Body3 className="pl-[12px] pr-[16px] font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } USDC`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.usdc / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                                <div className="flex flex-row justify-between md:pr-10">
                                  <div className="flex flex-row">
                                    <img
                                      src={assetRootPath(
                                        `/images/${strategy.name.slice(
                                          0,
                                          1
                                        )}usdt.svg`
                                      )}
                                      className="w-6"
                                    />
                                    <Typography.Body3 className="pl-[12px] pr-[16px] font-light">{`${
                                      strategy.name.charAt(0).toUpperCase() +
                                      strategy.name.slice(1)
                                    } USDT`}</Typography.Body3>
                                  </div>
                                  <Typography.Body3 className="text-[#b5beca] font-light">{`${formatCurrency(
                                    (strategy.usdt / strategy.total) * 100,
                                    2
                                  )}%`}</Typography.Body3>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-row justify-between md:pr-10">
                                <div className="flex flex-row">
                                  <img
                                    src={assetRootPath(
                                      `/images/convex-3pool.svg`
                                    )}
                                    className="w-6"
                                  />
                                  <Typography.Body3 className="pl-[12px] pr-[16px] font-light">
                                    Convex 3pool
                                  </Typography.Body3>
                                </div>
                                <Typography.Body3 className="text-[#b5beca] font-light">{`${formatCurrency(
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
            <Typography.H7 className="font-normal">
              {fbt('See how yield is generated', 'See how yield is generated')}
            </Typography.H7>
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
