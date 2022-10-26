import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Animation from 'components/Animation'
import Apy from 'components/Apy'
import Allocation from 'components/Allocation'
import Collateral from 'components/Collateral'
import Ogv from 'components/Ogv'
import { fetchAPI } from '../lib/api'
import formatSeo from '../src/utils/seo'
import transformLinks from '../src/utils/transformLinks'
import { Typography, Header } from '@originprotocol/origin-storybook'
import { formatCurrency } from 'utils/math'
import { assetRootPath } from 'utils/image'

import Closing from 'components/Closing'
import EmailForm from 'components/EmailForm'
import GetOUSD from 'components/GetOUSD'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import ApySelect from 'components/ApySelect'
import ContractStore from 'stores/ContractStore'
import { animateValue } from 'utils/animation'
import { getDocsLink } from 'utils/getDocsLink'

import { DEFAULT_SELECTED_APY } from 'utils/constants'
import { zipObject } from 'lodash'

const discordURL = process.env.DISCORD_URL
const jobsURL = process.env.JOBS_URL
const githubURL = process.env.GITHUB_URL

const Home = ({ locale, onLocale, articles, seo, navLinks }) => {
  const audits = ['Trail of bits', 'Certora', 'Solidified', 'OpenZeppelin']

  return (
    <Layout locale={locale}>
      <Animation navLinks={navLinks} />
      <Apy />
      <Allocation />
      <Collateral />
      <section className="home black">
        <div className="pb-20 px-2 md:px-8 text-center">
          <Typography.H4>Audited by leading security experts</Typography.H4>
          <br className="block" />
          <Typography.Body2 className="opacity-75">
            Securing your funds is OUSD’s top priority. Changes to the protocol
            are reviewed by internal and external auditors on an ongoing basis.
          </Typography.Body2>
          <div className="audits rounded-xl m-6 md:m-16 md:mx-40 p-6 md:p-10">
            <Typography.Body>Existing audits</Typography.Body>
            <div className="grid grid-rows-2 grid-cols-2 md:flex md:flex-row md:justify-around mt-6 md:mt-10">
              {audits.map((audit) => {
                return (
                  <div className="m-2 md:m-0" key={audit}>
                    <div className="item relative rounded-full w-28 h-28 md:w-48 md:h-48 mb-6">
                      <img
                        src={assetRootPath(
                          `/images/${audit
                            .replace(/ /g, '-')
                            .toLowerCase()}.svg`
                        )}
                        className="w-1/2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                      />
                    </div>
                    <Typography.Body className="opacity-75">
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
            className="bttn gradient3"
          >
            Review audits
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

  return {
    props: {
      articles: articlesRes.data,
      seo: formatSeo(seoRes),
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  }
}

export default Home
