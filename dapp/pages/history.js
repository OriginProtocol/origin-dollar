import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'

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
        .home {
          padding-top: 20px;
        }

        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 0 0 10px 10px;
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

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}
