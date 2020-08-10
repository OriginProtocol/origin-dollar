import React, { useEffect } from 'react'
import ethers from 'ethers'

import network from '../../network.json'

const Dashboard = props => {
  const provider = new ethers.providers.JsonRpcProvider()
  const signer = provider.getSigner(0)

  for (const key in network.contracts) {
    network.contracts[key] = {
      ...network.contracts[key],
      instance: new ethers.Contract(
        network.contracts[key].address,
        network.contracts[key].abi
      )
    }
  }

  useEffect(() => {
    const loadBalances = async () => {}
    loadBalances()
  }, [])

  return (
    <div className="my-5">
      <h1>Balances</h1>
      <div>USDT:</div>
      <div>DAI:</div>
      <div>TUSD:</div>
      <div>USDC:</div>
      <br />
      <br />
      <h1>Contracts</h1>
      <div>Vault: {network.contracts.Vault.address}</div>
      <div>OUSD: {network.contracts.OUSD.address}</div>
      <div>Kernel: {network.contracts.Kernel.address}</div>
    </div>
  )
}

export default Dashboard

require('react-styl')(`
  
`)
