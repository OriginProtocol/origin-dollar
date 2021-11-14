import React, { useEffect, useState } from 'react'

import Layout from 'components/layout'
import Nav from 'components/Nav'
import BalanceHeader from 'components/buySell/BalanceHeader'
import TransactionHistory from 'components/TransactionHistory'

export default function History({ locale, onLocale }) {
  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav dapp page={'history'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <BalanceHeader />
          <TransactionHistory />
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding-top: 20px;
        }
        @media (max-width: 799px) {
          .home {
            padding: 0;
          }
        }
      `}</style>
    </>
  )
}
