import React, { useState } from 'react'
import { Typography, Header } from '@originprotocol/origin-storybook'
import { fbt } from 'fbt-runtime'
import Layout from 'components/layout'
import { useRouter } from 'next/router'
import { fetchAPI } from '../lib/api'
import Seo from '../src/components/strapi/seo'
import formatSeo from '../src/utils/seo'
import transformLinks from '../src/utils/transformLinks'
import { assetRootPath } from 'utils/image'
import { capitalize } from 'lodash'

const Faq = ({ locale, onLocale, faq, seo, navLinks }) => {
  const { pathname } = useRouter()
  const active = capitalize(pathname.slice(1))
  const [open, setOpen] = useState({})

  return (
    <>
      <Seo seo={seo} />
      <Layout locale={locale}>
        <section className="page black">
          <Header mappedLinks={navLinks} webProperty="ousd" active={'FAQ'} />
          <div className="max-w-screen-2xl mt-[20px] md:mt-16 mx-auto pb-[132px] px-[16px] md:px-[134px] text-left">
            <Typography.H2 as="h1" className="font-normal">
              FAQ
            </Typography.H2>
            <div className="mt-20 space-y-6">
              {faq?.map((q, i) => {
                return (
                  <div
                    className="max-w-[959px] p-[16px] md:p-8 rounded-xl bg-[#1e1f25] text-[#fafbfb] cursor-pointer"
                    key={i}
                    onClick={(e) => {
                      e.preventDefault()
                      setOpen({
                        ...open,
                        [i]: !open[i],
                      })
                    }}
                  >
                    <div className="flex flex-row justify-between">
                      <Typography.H7
                        className="text-base md:text-xl"
                        style={{ fontWeight: 700 }}
                      >
                        {q.attributes.question}
                      </Typography.H7>
                      <img
                        src={assetRootPath(`/images/caret.svg`)}
                        className={`w-4 md:w-6 ml-[16px] md:ml-8 mb-2 inline ${
                          open[i] ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    <div className={`${open[i] ? '' : 'hidden'}`}>
                      <Typography.Body3 className="mt-8">
                        {q.attributes.answer}
                      </Typography.Body3>
                    </div>
                  </div>
                )
              })}
            </div>
            <Typography.H5
              className="text-[20px] md:text-[32px] mt-14 md:mt-15 inline-block"
              style={{ fontWeight: 700 }}
            >
              {'Still have questions?'}
              <br />
              {'Reach out to us on our '}
              <a
                href="https://discord.gg/jyxpUSe"
                target="_blank"
                rel="noopener noreferrer"
              >
                {'discord'}
              </a>
              <div className="h-1 w-[72px] md:w-[116px] mr-0 ml-auto mt-[4px] bg-gradient-to-r from-[#8c66fc] to-[#0274f1] rounded-full"></div>
            </Typography.H5>
          </div>
        </section>
      </Layout>
    </>
  )
}

export async function getStaticProps() {
  const faqRes = await fetchAPI('/ousd-faqs')
  const seoRes = await fetchAPI('/ousd/page/en/%2Ffaq')
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
      faq: faqRes?.data || null,
      seo: formatSeo(seoRes?.data),
      navLinks,
    },
    revalidate: 5 * 60, // Cache response for 5m
  }
}

export default Faq
