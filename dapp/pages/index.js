import React from 'react'
import dynamic from 'next/dynamic'

import BalanceHeader from 'components/buySell/BalanceHeader'
import MissionControl from 'components/MissionControl'
import PrimarySidePanel from 'components/sidePanel/PrimarySidePanel'

const Layout = dynamic(() => import('components/layout'), {
  ssr: false,
})

const Nav = dynamic(() => import('components/Nav'), {
  ssr: false,
})

export default function DApp({ locale, onLocale }) {
  return (
    <>
      <Layout locale={locale} onLocale={onLocale}>
        <Nav page={'swap'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <BalanceHeader />
          <div className="d-flex">
            <MissionControl />
            <PrimarySidePanel />
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
