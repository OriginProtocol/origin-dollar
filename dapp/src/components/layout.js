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

const Layout = ({
  locale,
  onLocale,
  children,
  dapp,
  short,
  shorter,
  medium,
  hideOusdRelaunchBanner,
  isStakePage,
}) => {
  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {isStakePage && (
          <>
            <meta
              property="og:image"
              key="og:image"
              content="https://ousd.com/images/staking-facebook.png"
            />
            <meta
              name="twitter:image"
              key="twitter:image"
              content="https://ousd.com/images/staking-twitter.png"
            />
          </>
        )}
        {!isStakePage && (
          <>
            <meta
              property="og:image"
              key="og:image"
              content="https://ousd.com/images/share-facebook.png"
            />
            <meta
              name="twitter:image"
              key="twitter:image"
              content="https://ousd.com/images/share-twitter.png"
            />
          </>
        )}
      </Head>
      {!hideOusdRelaunchBanner && (
        <div
          className={classnames('notice text-white text-center p-3', { dapp })}
        >
          {fbt(
            'OUSD has relaunched with independent audits and a renewed focus on security.',
            'Ousd has relaunched banner message'
          )}
        </div>
      )}
      <main className={classnames({ dapp, short, shorter, medium })}>
        {dapp && <div className="container">{children}</div>}
        {!dapp && children}
      </main>
      {!dapp && <MarketingFooter locale={locale} />}
      {dapp && <AppFooter dapp={dapp} locale={locale} onLocale={onLocale} />}
      <style jsx>{`
        .notice {
          background-color: black;
          margin-bottom: 35px;
        }

        .notice.dapp {
          margin-bottom: 0px;
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

export default Layout
