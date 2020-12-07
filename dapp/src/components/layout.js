import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import { useEffect, useRef } from 'react'
import { useCookies } from 'react-cookie'

import AccountStore from 'stores/AccountStore'
import { useEagerConnect, useInactiveListener } from 'utils/hooks'

import AppFooter from './AppFooter'
import MarketingFooter from './MarketingFooter'

export default function Layout({
  locale,
  onLocale,
  children,
  dapp,
  short,
  shorter,
}) {
  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="notice text-white text-center p-3">
        OUSD is currently disabled due to a recent exploit. Read our post{' '}
        <u>
          <a
            href="https://medium.com/originprotocol/urgent-ousd-has-hacked-and-there-has-been-a-loss-of-funds-7b8c4a7d534c"
            target="_blank"
            rel="noopener noreferrer"
          >
            on Medium
          </a>
        </u>{' '}
        to learn about what happened. We will provide ongoing updates there and
        on{' '}
        <u>
          <a
            href="https://twitter.com/originprotocol"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter
          </a>
        </u>
        .
      </div>
      <main className={classnames({ dapp, short, shorter })}>
        {dapp && <div className="container">{children}</div>}
        {!dapp && children}
      </main>
      {!dapp && <MarketingFooter locale={locale} />}
      {dapp && <AppFooter dapp={dapp} locale={locale} onLocale={onLocale} />}
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
