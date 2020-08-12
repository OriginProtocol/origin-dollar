import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import ethers from 'ethers'

import network from '../../network.json'
import Connectors from '../components/Connectors'
import { useEagerConnect } from '../hooks'

window.contracts = network.contracts

const num = 6200 * Math.pow(10, 18)
const infiniteApprovalHex = '0x' + num.toString(16)

const Dashboard = () => {
  const { library, account } = useWeb3React()

  const [balances, setBalances] = useState({})

  useEagerConnect()

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
    const loadBalances = async () => {
      if (!account) return
      const usdt = await MockUSDT.instance.balanceOf(account)
      const dai = await MockDAI.instance.balanceOf(account)
      const tusd = await MockTUSD.instance.balanceOf(account)
      const usdc = await MockUSDC.instance.balanceOf(account)
      const ousd = await OUSD.instance.balanceOf(account)
      setBalances({
        ...balances,
        usdt,
        dai,
        tusd,
        usdc,
        ousd,
      })
    }
    loadBalances()
  }, [account])

  const buyOusd = async () => {
    await MockUSDT.instance.approve(Vault.address, infiniteApprovalHex)
    // await Vault.instance.createMarket(MockDAI.address)
    await Vault.instance.depositAndMint(MockUSDT.address, 100)
  }

  const tableRows = () => {
    return ['usdt', 'dai', 'tusd', 'usdc'].map((x) => (
      <tr key={x}>
        <td>{x.toUpperCase()}</td>
        <td>None</td>
        <td>1</td>
        <td>{balances[x] && Number(balances[x]).toFixed(2)}</td>
      </tr>
    ))
  }

  return (
    <div className="my-5">
      <h1>Balances</h1>
      {account && (
        <>
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
          <div className="btn btn-primary mt-4" onClick={buyOusd}>
            Buy OUSD
          </div>
        </>
      )}
      {!account && <>Connect wallet</>}
      <br />
      <br />
      <h1>Wallet Connectors</h1>
      <Connectors />
    </div>
  )
}

export default Dashboard

require('react-styl')(``)
