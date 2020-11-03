import React from 'react'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import PoolDetails from 'components/earn/PoolDetails'
import { useRouter } from 'next/router'
import { fbt } from 'fbt-runtime'

export default function PoolDetailsPage({ locale, onLocale }) {
  const router = useRouter()
  const { pool_name } = router.query

  // TODO fetch from smart contract
  const pools = [
    {
      name: 'Uniswap V2: OUSD/OGN',
      coin_one: {
        name: 'OUSD',
        icon: 'ousd-token-icon.svg',
        contract_address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d'
      },
      coin_two: {
        name: 'OGN',
        icon: 'ogn-icon-blue.svg',
        contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'
      },
      pool_deposits: '43748848',
      pool_rate: '500000',
      current_apy: 0.8925,
      pool_contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86',
      your_weekly_rate: '75',
      claimable_ogn: 12353.123,
      rewards_boost: 2.5,
      lp_tokens: 12345
    },
    {
      name: 'OUSD/USDT',
      coin_one: {
        name: 'OUSD',
        icon: 'ousd-token-icon.svg',
        contract_address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d'
      },
      coin_two: {
        name: 'USDT',
        icon: 'usdt-icon-full.svg',
        contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'
      },
      pool_deposits: '124748848',
      pool_rate: '300000',
      current_apy: 0.0991,
      pool_contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86',
      lp_tokens: 12345
    },
    {
      name: 'OUSD/DAI',
      coin_one: {
        name: 'OUSD',
        icon: 'ousd-token-icon.svg',
        contract_address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d'
      },
      coin_two: {
        name: 'DAI',
        icon: 'dai-icon.svg',
        contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'
      },
      pool_deposits: '14748848',
      pool_rate: '300000',
      current_apy: 0.1791,
      pool_contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86',
    }
  ]
  const pool = pools.filter(pool => pool.name === pool_name)[0]

  return (
    <>
      <Layout dapp short>
        <Nav
          dapp
          locale={locale}
          onLocale={onLocale}
        />
        <div className="home d-flex flex-column">
          <PoolDetails pool={pool}/>
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
