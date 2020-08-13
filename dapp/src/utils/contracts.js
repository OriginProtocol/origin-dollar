import React, { useEffect } from 'react'
import ethers from 'ethers'
import network from '../../network.json'

import ContractStore from 'stores/ContractStore'

export function setupContracts(account, library) {
  let contracts = {}
  for (const key in network.contracts) {
    contracts[key] = new ethers.Contract(
      network.contracts[key].address,
      network.contracts[key].abi,
      library ? library.getSigner(account) : null
    )
  }
  // const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts
  
  ContractStore.update(s => {
    s.contracts = contracts
  })
}