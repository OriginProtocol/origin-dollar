import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'

let network
if (process.env.NODE_ENV === 'production') {
  network = require('../../prod.network.json')
} else {
  network = require('../../network.json')
}

export function setupContracts(account, library) {
  // without an account logged in contracts are initilised with JsonRpcProvider and
  // can operate in a read-only mode
  let provider = new ethers.providers.JsonRpcProvider(
    process.env.ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
  )

  if (account && library) {
    provider = library.getSigner(account)
  }

  let contracts = {}
  for (const key in network.contracts) {
    // Use Proxy address if one exists
    const address = network.contracts[`${key}Proxy`]
      ? network.contracts[`${key}Proxy`].address
      : network.contracts[key].address

    contracts[key] = new ethers.Contract(
      address,
      network.contracts[key].abi,
      provider
    )
  }

  // execute in parallel
  setTimeout(async () => {
    const apr = await contracts.Vault.getAPR()
    ContractStore.update((s) => {
      s.apr = apr.toNumber()
    })
  }, 1)

  // const { MockUSDT, MockDAI, MockTUSD, MockUSDC, OUSD, Vault } = contracts
  ContractStore.update((s) => {
    s.contracts = contracts
  })
  return contracts
}
