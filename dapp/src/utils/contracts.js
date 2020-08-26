import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'

let network
if (process.env.NODE_ENV === 'production') {
  network = require('../../prod.network.json')
} else {
  network = require('../../network.json')
}

export function setupContracts(account, library) {
  if (!account)
    return

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
  return contracts
}