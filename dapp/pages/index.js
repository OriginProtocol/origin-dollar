import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import Animation from 'components/Animation'
import Apy from 'components/Apy'
import Allocation from 'components/Allocation'
import Collateral from 'components/Collateral'
import Ogv from 'components/Ogv'
import Seo from 'components/strapi/seo'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { fetchAPI } from '../lib/api'
import formatSeo from '../src/utils/seo'
import transformLinks from '../src/utils/transformLinks'
import { Typography, Header, Button } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import Layout from 'components/layout'
import { audits } from 'utils/constants'
import { capitalize } from 'lodash'
import { apyHistoryService } from '../src/services/apy-history.service'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import useAllocationQuery from '../src/queries/useAllocationQuery'
import useCollateralQuery from '../src/queries/useCollateralQuery'

const Home = ({ locale, onLocale, seo, navLinks, apy }) => {
  const { pathname } = useRouter()
  const active = capitalize(pathname.slice(1))

  const allocation = useStoreState(ContractStore, (s) => {
    return s.allocation || {}
  })

  const collateral = useStoreState(ContractStore, (s) => {
    return s.collateral || {}
  })

  const allocationQuery = useAllocationQuery({
    onSuccess: (allocation) => {
      ContractStore.update((s) => {
        s.allocation = allocation
      })
    },
  })

  const collateralQuery = useCollateralQuery({
    onSuccess: (collateral) => {
      ContractStore.update((s) => {
        s.collateral = collateral
      })
    },
  })

  useEffect(() => {
    allocationQuery.refetch()
    collateralQuery.refetch()
  }, [])

  return (
    <>
      <Seo seo={seo} />
      <Layout locale={locale}>
        <Animation navLinks={navLinks} active={active} />
        <Apy apy={apy} />
        <Allocation allocation={allocation} />
        <Collateral collateral={collateral} allocation={allocation} />
        <section className="home black">
          <div className="py-[120px] px-[16px] md:px-[200px] text-center">
            <Typography.H6
              className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
              style={{ fontWeight: 700 }}
            >
              {fbt(
                'Audited by leading security experts',
                'Audited by leading security experts'
              )}
            </Typography.H6>
            <Typography.Body3 className="md:max-w-[943px] mt-[16px] mx-auto text-[#b5beca]">
              {fbt(
                'Securing your funds is OUSD’s top priority. Changes to the protocol are reviewed by internal and external auditors on an ongoing basis.',
                'Securing your funds is OUSD’s top priority. Changes to the protocol are reviewed by internal and external auditors on an ongoing basis.'
              )}
            </Typography.Body3>
            <div className="audits max-w-[1134px] mx-auto mt-20 mb-16 rounded-xl px-[16px] xl:px-[86px] py-6 md:py-[56px]">
              <Typography.H7 className="font-bold">
                {fbt('Existing audits', 'Existing audits')}
              </Typography.H7>
              <div className="grid grid-rows-2 grid-cols-2 gap-y-20 2xl:flex 2xl:flex-row 2xl:justify-between mt-6 md:mt-[56px] mx-auto">
                {audits.map((audit, i) => {
                  return (
                    <div className={`mx-auto`} key={audit}>
                      <div className="item relative rounded-full w-28 h-28 xl:w-[200px] xl:h-[200px]">
                        <img
                          src={assetRootPath(
                            `/images/${audit
                              .replace(/ /g, '-')
                              .toLowerCase()}.svg`
                          )}
                          className="w-50 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                      </div>
                      <Typography.Body className="mt-[8px] md:mt-6 opacity-75">
                        {audit}
                      </Typography.Body>
                    </div>
                  )
                })}
              </div>
            </div>
            <a
              href="https://docs.ousd.com/security-and-risks/audits"
              target="_blank"
              rel="noopener noreferrer"
              className="bttn gradient2"
            >
              <Typography.H7 className="font-normal">
                {fbt('Review audits', 'Review audits')}
              </Typography.H7>
            </a>
          </div>
        </section>
        <Ogv />
        <style jsx>{`
          .audits {
            background-color: #1e1f25;
          }

          .item {
            background-color: #141519;
          }
        `}</style>
      </Layout>
    </>
  )
}

export async function getStaticProps() {
  const articlesRes = await fetchAPI('/ousd/blog/en')
  const seoRes = await fetchAPI('/ousd/page/en/%2F')
  const navRes = await fetchAPI('/ousd-nav-links', {
    populate: {
      links: {
        populate: '*',
      },
    },
  })

  const navLinks = transformLinks(navRes.data)

  const apy = JSON.stringify(apyHistoryService.fetchApyHistory())

  return {
    props: {
      articles: articlesRes.data,
      seo: formatSeo(seoRes?.data),
      navLinks,
      apy,
    },
    revalidate: 5 * 60, // Cache response for 5m
  }
}

export default Home
