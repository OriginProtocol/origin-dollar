import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'
import Head from 'next/head'
import { NextScript } from 'next/document'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import BalanceHeader from 'components/buySell/BalanceHeader'
import TransactionHistory from 'components/TransactionHistory'
import GetOUSD from 'components/GetOUSD'
import { assetRootPath } from 'utils/image'

export default function History({ locale, onLocale }) {
  const { active } = useWeb3React()

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
        {/* jQuery is required for bootstrap javascript */}
        <NextScript
          src="https://code.jquery.com/jquery-3.6.0.slim.min.js"
          integrity="sha384-Qg00WFl9r0Xr6rUqNLv1ffTSSKEFFCDCKVyHZ+sVt8KuvG99nWw5RNvbhuKgif9z"
        />
        <NextScript
          src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js"
          integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo"
        />
      </Head>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav dapp page={'history'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <BalanceHeader />
          {active && <TransactionHistory />}
          {!active && (
            <div className="empty-placeholder d-flex flex-column align-items-center justify-content-start">
              <img src={assetRootPath('/images/wallet-icons.svg')} />
              <div className="header-text">
                {fbt('No wallet connected', 'Disconnected dapp message')}
              </div>
              <div className="subtext">
                {fbt(
                  'Please connect an Ethereum wallet',
                  'Disconnected dapp subtext'
                )}
              </div>
              <GetOUSD primary connect trackSource="Dapp widget body" />
            </div>
          )}
        </div>
      </Layout>
      <style jsx>{`
        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 10px;
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .header-text {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-top: 23px;
          margin-bottom: 10px;
        }

        .subtext {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #8293a4;
          margin-bottom: 50px;
        }

        @media (min-width: 799px) {
          .home {
            padding-top: 20px;
          }
        }
      `}</style>
    </>
  )
}
