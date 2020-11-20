import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'


export default function Stake({ locale, onLocale }) {

  return process.env.ENABLE_LIQUIDITY_MINING === 'true' && <>
    <Layout onLocale={onLocale} locale={locale} dapp>
      <Nav
        dapp
        page={'stake'}
        locale={locale}
        onLocale={onLocale}
      />
      <div className="home d-flex flex-column">
        
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
}
