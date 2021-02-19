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

const UNISWAP_URL =
  'https://app.uniswap.org/#/swap?inputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7&outputCurrency=0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'

const Layout = ({
  locale,
  onLocale,
  children,
  dapp,
  short,
  shorter,
  medium,
  isStakePage,
  showUniswapNotice,
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
      <div
        className={classnames(
          'notice text-white text-center p-3',
          {
            dapp,
          },
          showUniswapNotice ? '' : 'd-none'
        )}
      >
        <div className="container d-flex flex-column flex-md-row align-items-center">
          <img src="/images/horsey.svg" className="mb-2 mb-md-0 mr-md-3" />
          {fbt(
            'Gas fees are high right now. It might be cheaper to buy OUSD on Uniswap.',
            'Uniswap notice'
          )}
          <a
            href={UNISWAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-dark mt-3 mt-md-0 ml-md-auto"
          >
            Try Uniswap
          </a>
        </div>
      </div>
      <main className={classnames({ dapp, short, shorter, medium })}>
        {dapp && <div className="container">{children}</div>}
        {!dapp && children}
      </main>
      {!dapp && <MarketingFooter locale={locale} />}
      {dapp && <AppFooter dapp={dapp} locale={locale} onLocale={onLocale} />}
      <style jsx>{`
        .notice {
          background-color: #7a26f3;
          margin-bottom: 35px;
        }

        .notice.dapp {
          margin-bottom: 0px;
        }

        .notice .btn {
          font-size: 12px;
          height: auto;
          padding: 5px 20px;
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
