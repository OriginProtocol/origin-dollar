import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

import PrimaryPoolsList from 'components/earn/PrimaryPoolsList'

export default function DApp({ locale, onLocale }) {
  return (
    <>
      <Layout dapp>
        <Nav
          dapp
          page={'earn'}
          locale={locale}
          onLocale={onLocale}
        />
        <div className="home d-flex">
          <PrimaryPoolsList />
        </div>
      </Layout>
      <style jsx>{`
        .home {
          padding-top: 80px;
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
