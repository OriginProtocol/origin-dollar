import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import { useEffect, useRef } from 'react'
import { useCookies } from 'react-cookie'

import AccountStore from 'stores/AccountStore'
import { useEagerConnect, useInactiveListener } from 'utils/hooks'

import AppFooter from './AppFooter'
import MarketingFooter from './MarketingFooter'

export default function Layout({ locale, children, dapp }) {
  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="notice text-white text-center p-3">
        Our team is actively investigating a hack of the OUSD vault. We will
        provide ongoing updates via{' '}
        <u>
          <a
            href="https://twitter.com/originprotocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter
          </a>
        </u>{' '}
        as we learn more.
      </div>
      <main className={classnames({ dapp })}>
        {dapp && <div className="container">{children}</div>}
        {!dapp && children}
      </main>
      {!dapp && <MarketingFooter locale={locale} />}
      {dapp && <AppFooter locale={locale} />}
      <style jsx>{`
        .notice {
          background-color: black;
        }
        .container {
          max-width: 940px !important;
          padding-left: 0px;
          padding-right: 0px;
        }
      `}</style>
    </>
  )
}
