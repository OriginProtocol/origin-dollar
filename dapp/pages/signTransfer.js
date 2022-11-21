import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

import SignTransferAuth from 'components/SignTransferAuth'
import AccountListener from 'components/AccountListener'

export default function DApp({ locale, onLocale }) {
  return (
    <>
      <Layout locale={locale} onLocale={onLocale} dapp>
        <Nav dapp page={'swap'} locale={locale} onLocale={onLocale} />
        <AccountListener />
        <div className="home d-flex flex-column">
          <div className="d-flex">
            <SignTransferAuth />
          </div>
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
