import React from 'react'
import Pool from 'components/earn/Pool'

export default function PrimaryPoolsList(props) {
  // TODO fetch from smart contract
  const pools = [
    {
      name: 'OUSD/OGN',
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
      pool_deposits: '43,748,848',
      pool_rate: '500000',
      current_apy: '0.8925',
      your_weekly_rate: '75',
      claimable_ogn: 12353.123,
      rewards_boost: 2.5
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
      pool_deposits: '14,748,848',
      pool_rate: '300000',
      current_apy: '0.1791'
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
        icon: 'usdt-icon.svg',
        contract_address: '0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'
      },
      pool_deposits: '124,748,848',
      pool_rate: '300000',
      current_apy: '0.0991',
      lp_tokens: 12345
    }
  ]

  return (
    <div className="d-flex flex-column w-100">
      {pools.map(pool => <Pool
        pool={pool}
        key={pool.name}
      />)}
      <style jsx>{`
        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
