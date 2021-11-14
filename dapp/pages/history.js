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
        <div className="d-flex flex-column p-0 pt-md-5">
          <BalanceHeader />
          <TransactionHistory />
        </div>
      </Layout>
      <style jsx>{`
        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}
