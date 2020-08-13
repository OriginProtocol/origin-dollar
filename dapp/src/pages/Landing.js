import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import ethers from 'ethers'

import network from '../../network.json'
import Connectors from '../components/Connectors'
import Redirect from '../components/Redirect'
import LoginWidget from '../components/LoginWidget'
import { useEagerConnect, useInterval } from '../hooks'

window.contracts = network.contracts

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Lading = () => {
  const { library, account } = useWeb3React()

  const [balances, setBalances] = useState({})
  const [allowances, setAllowances] = useState({})

  useEagerConnect()

  const isGovernor = account === governorAddress

  for (const key in network.contracts) {
    network.contracts[key] = {
      ...network.contracts[key],
      instance: new ethers.Contract(
        network.contracts[key].address,
        network.contracts[key].abi,
        library ? library.getSigner(account) : null
      ),
    }
  }

  const {
    MockUSDT,
    MockDAI,
    MockTUSD,
    MockUSDC,
    OUSD,
    Vault,
  } = network.contracts

  useEffect(() => {
    loadBalances()
    loadAllowances()
  }, [account])

  const loadBalances = async () => {
    if (!account) return
    const ousd = await OUSD.instance.balanceOf(account)
    const usdt = await MockUSDT.instance.balanceOf(account)
    const dai = await MockDAI.instance.balanceOf(account)
    const tusd = await MockTUSD.instance.balanceOf(account)
    const usdc = await MockUSDC.instance.balanceOf(account)
    setBalances({
      ...balances,
      usdt,
      dai,
      tusd,
      usdc,
      ousd,
    })
  }

  useInterval(() => {
    loadBalances()
  }, 2000)

  const loadAllowances = async () => {
    const usdt = await MockUSDT.instance.allowance(account, Vault.address)
    const dai = await MockDAI.instance.allowance(account, Vault.address)
    const tusd = await MockTUSD.instance.allowance(account, Vault.address)
    const usdc = await MockUSDC.instance.allowance(account, Vault.address)
    setAllowances({
      ...allowances,
      usdt,
      dai,
      tusd,
      usdc,
    })
  }

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
      {/*account && (
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
      )*/}
      {account && <Redirect to="/dashboard"/>}
      <div className="d-flex justify-content-center">
        <LoginWidget/>
      </div>
    </div>
  )
}

export default Lading

require('react-styl')(``)
