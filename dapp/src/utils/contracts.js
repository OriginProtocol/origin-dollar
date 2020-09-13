import ethers, { Contract, BigNumber } from 'ethers'

import ContractStore from 'stores/ContractStore'
import addresses from 'constants/contractAddresses'

import usdtAbi from 'constants/mainnetAbi/usdt.json'
import usdcAbi from 'constants/mainnetAbi/cUsdc.json'
import daiAbi from 'constants/mainnetAbi/dai.json'

export async function setupContracts(account, library, chainId) {
  if (chainId === undefined) {
    return
  }

  // without an account logged in contracts are initilised with JsonRpcProvider and
  // can operate in a read-only mode
  let provider = new ethers.providers.JsonRpcProvider(
    process.env.ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
  )

  if (account && library) {
    provider = library.getSigner(account)
  }

  let usdt, dai, tusd, usdc, ousd, vault, viewVault
  if (process.env.NODE_ENV === 'development') {
    const isMainnetFork = chainId === 1337
    const isLocal = chainId === 31337
    let network
    if (isLocal || isMainnetFork) {
      try {
        network = require('../../network.json')
      } catch (e) {
        console.error('network.json file not present')
      }
    }

    const contracts = {}
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

    const getContract = (address, abi) => {
      return new ethers.Contract(address, abi, provider)
    }

    const ousdProxy = contracts['OUSDProxy']
    const vaultProxy = contracts['VaultProxy']

    try {
      viewVault = getContract(
        vaultProxy.address,
        require('../../IViewVault.json').abi
      )
    } catch (e) {
      console.error('IViewVault.json not present')
    }
    if (isMainnetFork) {
      usdt = getContract(addresses.mainnet.USDT, usdtAbi.abi)
      usdc = getContract(addresses.mainnet.USDC, usdcAbi.abi)
      dai = getContract(addresses.mainnet.DAI, daiAbi.abi)
      // ousd and vault are not yet deployed to mainnet
      ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
      vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
    } else if (isLocal) {
      usdt = contracts['MockUSDT']
      usdc = contracts['MockUSDC']
      dai = contracts['MockDAI']
      ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
      vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
    }
  } else {
    usdt = getContract(addresses.mainnet.USDT, usdtAbi)
    usdc = getContract(addresses.mainnet.USDC, usdcAbi)
    dai = getContract(addresses.mainnet.DAI, daiAbi)

    // TODO: once deployed to mainnet update the contract addresses
    throw new Error('ousd and vault are not yet deployed to mainnet')
    // ousd and vault are not yet deployed to mainnet
    // ousd = await ethers.getContractAt("OUSD", ousdProxy.address)
    // vault = await ethers.getContractAt("Vault", vaultProxy.address)
  }

  const fetchExchangeRates = async () => {
    const coins = ['dai', 'usdt', 'usdc']
    const ousdExchangeRates = {
      ...ContractStore.currentState.ousdExchangeRates,
    }

    for (const coin of coins) {
      try {
        const priceBN = await viewVault.priceUSD(coin.toUpperCase())

        // Oracle returns with 18 decimal places
        // Also, convert that to USD/<coin> format
        const price = Number(priceBN.toString()) / 1000000000000000000

        ousdExchangeRates[(coin, price)]
      } catch (err) {
        console.error('Failed to fetch exchange rate')
      }
    }

    ContractStore.update((store) => {
      store.ousdExchangeRates = { ...ousdExchangeRates }
    })
  }

  // execute in parallel
  setTimeout(async () => {
    fetchExchangeRates()
    const apr = await viewVault.getAPR()
    ContractStore.update((s) => {
      s.apr = apr.toNumber()
    })
  }, 2)

  const contractToExport = {
    usdt,
    dai,
    tusd,
    usdc,
    ousd,
    vault,
    viewVault,
  }

  ContractStore.update((s) => {
    s.contracts = contractToExport
  })

  return contractToExport
}
