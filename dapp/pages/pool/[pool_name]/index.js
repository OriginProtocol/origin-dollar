import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import PoolDetails from 'components/earn/PoolDetails'
import { useRouter } from 'next/router'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import ContractStore from 'stores/ContractStore'
import PoolStore from 'stores/PoolStore'

export default function PoolDetailsPage({ locale, onLocale }) {
  const router = useRouter()
  const { pool_name } = router.query
  const { uniV2OusdUsdt, liquidityOusdUsdt } = useStoreState(
    ContractStore,
    (s) => s.contracts || {}
  )
  const pools = useStoreState(PoolStore, (s) => s.pools)
  const pool = pools.filter((pool) => pool.name === pool_name)[0]

  return (
    process.env.ENABLE_LIQUIDITY_MINING === 'true' && (
      <>
        <Layout onLocale={onLocale} locale={locale} dapp short>
          <Nav dapp page={'pool-details'} locale={locale} onLocale={onLocale} />
          <div className="home d-flex flex-column">
            {pools.length > 0 && <PoolDetails pool={pool} />}
            {pools.length === 0 && <h1>{fbt('Loading...', 'Loading...')}</h1>}
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
  )
}
