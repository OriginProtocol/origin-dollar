import React, { useEffect, useState } from 'react'
import { useStoreState } from 'pullstate'

import Connectors from '../components/Connectors'
import Redirect from '../components/Redirect'
import LoginWidget from '../components/LoginWidget'
import AccountStore from 'stores/AccountStore'

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = () => {
  const [balances, setBalances] = useState({})
  const [allowances, setAllowances] = useState({})

  const account = useStoreState(AccountStore, s => s.account)
  const isGovernor = account && account === governorAddress


  const buyOusd = async () => {
    await Vault.instance.depositAndMint(MockUSDT.address, 100)
    await loadBalances()
  }

  const depositYield = async () => {
    await Vault.instance.depositYield(MockUSDT.address, 10)
    await loadBalances()
  }

  const tableRows = () => {
    return ['usdt', 'dai', 'tusd', 'usdc'].map((x) => (
      <tr key={x}>
        <td>{x.toUpperCase()}</td>
        <td>{Number(allowances[x]).toFixed(2)}</td>
        <td>1</td>
        <td>{balances[x] && Number(balances[x]).toFixed(2)}</td>
      </tr>
    ))
  }

  return (
    <div className="my-5">
      {account && (
        <>
          <h1>Balances</h1>
          <div className="card w25 mb-4">
            <div className="card-body">
              <h5 className="card-title">Current Balance</h5>
              <p className="card-text">
                {balances.ousd && Number(balances.ousd).toFixed(2)}
              </p>
            </div>
          </div>
          <table className="table table-bordered">
            <thead>
              <tr>
                <td>Asset</td>
                <td>Permission</td>
                <td>Exchange Rate</td>
                <td>Your Balance</td>
              </tr>
            </thead>
            <tbody>{tableRows()}</tbody>
          </table>
          {isGovernor && (
            <div className="btn btn-primary my-4 mr-3" onClick={depositYield}>
              Deposit $10 Yield
            </div>
          )}
          <div className="btn btn-primary my-4 mr-3" onClick={buyOusd}>
            Buy OUSD
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard

require('react-styl')(``)
