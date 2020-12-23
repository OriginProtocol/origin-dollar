import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useCookies } from 'react-cookie'
import { fbt } from 'fbt-runtime'

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
  hideStakeBanner,
}) {
  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      {!hideStakeBanner && (
        <div className="notice text-white text-center p-3">
          {fbt('OGN staking has arrived!', 'OGN staking has arrived!')}{' '}
          <Link href={'/stake'}>
            <a>{fbt('Earn up to 25% APY.', 'Earn up to 25% APY.')}</a>
          </Link>
        </div>
      )}
      <main className={classnames({ dapp, short, shorter })}>
        {dapp && <div className="container">{children}</div>}
        {!dapp && children}
      </main>
      {!dapp && <MarketingFooter locale={locale} />}
      {dapp && <AppFooter dapp={dapp} locale={locale} onLocale={onLocale} />}
      <style jsx>{`
        .notice {
          background-color: #1a82ff;
        }
        a {
          text-decoration: underline;
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
