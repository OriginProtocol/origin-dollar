import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'

import StakeUI from 'components/earn/StakeUI'
import CurveStake from 'components/earn/CurveStake'

const Stake = ({ locale, onLocale }) => {
  return (
    <Layout onLocale={onLocale} locale={locale} dapp shorter isStakePage>
      <Nav dapp page={'earn'} locale={locale} onLocale={onLocale} />
      {process.env.ENABLE_CURVE_STAKING === 'true' && <CurveStake />}
      {process.env.ENABLE_OGN_STAKING === 'true' && <StakeUI />}
    </Layout>
  )
}

export default Stake

//
// import { fbt } from 'fbt-runtime'
// import { useStoreState } from 'pullstate'
// import PoolsList from 'components/earn/PoolsList'
// import PoolStore from 'stores/PoolStore'
//
// export default function Earn({ locale, onLocale }) {
//   const pools = useStoreState(PoolStore, (s) => s.pools)
//
//   return (
//     process.env.ENABLE_LIQUIDITY_MINING === 'true' && (
//       <>
//         <Layout onLocale={onLocale} locale={locale} dapp>
//           <Nav dapp page={'earn'} locale={locale} onLocale={onLocale} />
//           <div className="home d-flex flex-column">
//             <PoolsList
//               title={fbt('Featured Pools', 'Featured Pools')}
//               titleStyle="white"
//               pools={pools.filter((pool) => pool.type === 'main')}
//             />
//             <PoolsList
//               title={fbt(
//                 'Featured Pool of the Week',
//                 'Featured Pool of the Week'
//               )}
//               pools={pools.filter((pool) => pool.type === 'featured')}
//             />
//             <PoolsList
//               title={fbt('Past pools', 'Past pools')}
//               pools={pools.filter((pool) => pool.type === 'inactive')}
//             />
//           </div>
//         </Layout>
//         <style jsx>{`
//           .home {
//             padding-top: 80px;
//           }
//
//           @media (max-width: 799px) {
//             .home {
//               padding: 0;
//             }
//           }
//         `}</style>
//       </>
//     )
//   )
// }
