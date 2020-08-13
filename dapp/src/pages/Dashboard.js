import React, { useEffect, useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import ethers from 'ethers'
import { get } from 'lodash'

import network from '../../network.json'
import Connectors from '../components/Connectors'
import Redirect from '../components/Redirect'
import LoginWidget from '../components/LoginWidget'
import { useEagerConnect, useInterval } from '../hooks'

window.contracts = network.contracts

const governorAddress = '0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4'

const Dashboard = () => {
  const { library, account } = useWeb3React()

  const [balances, setBalances] = useState({})
  const [allowances, setAllowances] = useState({})

  useEagerConnect()

  const isGovernor = account === governorAddress

  const contracts = {}
  for (const key in network.contracts) {
    contracts[key] = new ethers.Contract(
      network.contracts[key].address,
      network.contracts[key].abi,
      library ? library.getSigner(account) : null
    )
  }

  const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts

  useEffect(() => {
    loadBalances()
    loadAllowances()
  }, [account])

  const loadBalances = async () => {
    if (!account) return
    const ousd = await displayCurrency(await OUSD.balanceOf(account), OUSD)
    const usdt = await displayCurrency(
      await MockUSDT.balanceOf(account),
      MockUSDT
    )
    const dai = await displayCurrency(await MockDAI.balanceOf(account), MockDAI)
    const tusd = await displayCurrency(
      await MockTUSD.balanceOf(account),
      MockTUSD
    )
    const usdc = await displayCurrency(
      await MockUSDC.balanceOf(account),
      MockUSDC
    )
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
    const usdt = await displayCurrency(
      await MockUSDT.allowance(account, Vault.address),
      MockUSDT
    )
    const dai = await displayCurrency(
      await MockDAI.allowance(account, Vault.address),
      MockDAI
    )
    const tusd = await displayCurrency(
      await MockTUSD.allowance(account, Vault.address),
      MockTUSD
    )
    const usdc = await displayCurrency(
      await MockUSDC.allowance(account, Vault.address),
      MockUSDC
    )
    setAllowances({
      ...allowances,
      usdt,
      dai,
      tusd,
      usdc,
    })
  }

  const buyOusd = async () => {
    await Vault.depositAndMint(
      MockUSDT.address,
      ethers.utils.parseUnits('100.0', await MockUSDT.decimals())
    )
    await loadBalances()
  }

  const depositYield = async () => {
    await Vault.depositYield(
      MockUSDT.address,
      ethers.utils.parseUnits('10.0', await MockUSDT.decimals())
    )
    await loadBalances()
  }

  const tableRows = () => {
    return ['usdt', 'dai', 'tusd', 'usdc'].map((x) => (
      <tr key={x}>
        <td>{x.toUpperCase()}</td>
        <td>{get(allowances, x) > 100000000000 ? 'Unlimited' : 'None'}</td>
        <td>1</td>
        <td>{get(balances, x)}</td>
      </tr>
    ))
  }

  const displayCurrency = async (balance, contract) => {
    if (!balance) return
    return ethers.utils.formatUnits(balance, await contract.decimals())
  }

  return (
    <div className="my-5">
      {account && (
        <>
          <h1>Balances</h1>
          <div className="card w25 mb-4">
            <div className="card-body">
              <h5 className="card-title">Current Balance</h5>
              <p className="card-text">{get(balances, 'ousd')}</p>
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
