import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'

let network
if (process.env.NODE_ENV === 'production') {
  network = require('../../prod.network.json')
} else {
  network = require('../../network.json')
}

export function setupContracts(account, library) {
  if (!account) return

  let contracts = {}
  for (const key in network.contracts) {
    // Use Proxy address if one exists
    const address = network.contracts[`${key}Proxy`]
      ? network.contracts[`${key}Proxy`].address
      : network.contracts[key].address

    contracts[key] = new ethers.Contract(
      address,
      network.contracts[key].abi,
      library ? library.getSigner(account) : null
    )
  }
  // const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts
  ContractStore.update((s) => {
    s.contracts = contracts
  })
  return contracts
}
