import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import Head from 'next/head'
import { NextScript } from 'next/document'

import StakeUI from 'components/earn/StakeUI'
import CurveStake from 'components/earn/CurveStake'

const Stake = ({ locale, onLocale }) => {
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
      <Layout onLocale={onLocale} locale={locale} dapp shorter isStakePage>
        <Nav dapp page={'earn'} locale={locale} onLocale={onLocale} />
        {process.env.ENABLE_CURVE_STAKING === 'true' && <CurveStake />}
        {process.env.ENABLE_OGN_STAKING === 'true' && <StakeUI />}
      </Layout>
    </>
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
