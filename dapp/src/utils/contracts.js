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

  const getContract = (address, abi) => {
    return new ethers.Contract(address, abi, provider)
  }

  let network
  try {
    network = require('../../network.json')
  } catch (e) {
    console.error('network.json file not present')
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

  const ousdProxy = contracts['OUSDProxy']
  const vaultProxy = contracts['VaultProxy']

  let usdt, dai, tusd, usdc, ousd, vault, viewVault

  try {
    viewVault = getContract(
      vaultProxy.address,
      require('../../IViewVault.json').abi
    )
  } catch (e) {
    console.error('IViewVault.json not present')
  }

  if (chainId == 31337) {
    usdt = contracts['MockUSDT']
    usdc = contracts['MockUSDC']
    dai = contracts['MockDAI']
    ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
    vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
  } else {
    usdt = getContract(addresses.mainnet.USDT, usdtAbi.abi)
    usdc = getContract(addresses.mainnet.USDC, usdcAbi.abi)
    dai = getContract(addresses.mainnet.DAI, daiAbi.abi)
    ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
    vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
  }

  const fetchExchangeRates = async () => {
    const coins = ['dai', 'usdt', 'usdc']
    const ousdExchangeRates = {
      ...ContractStore.currentState.ousdExchangeRates,
    }

    for (const coin of coins) {
      try {
        const priceBNMint = await viewVault.priceUSDMint(coin.toUpperCase())
        const priceBNRedeem = await viewVault.priceUSDRedeem(coin.toUpperCase())
        // Oracle returns with 18 decimal places
        // Also, convert that to USD/<coin> format
        const priceMint = Number(priceBNMint.toString()) / 1000000000000000000
        const priceRedeem =
          Number(priceBNRedeem.toString()) / 1000000000000000000
        ousdExchangeRates[coin] = {
          mint: priceMint,
          redeem: priceRedeem,
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate')
      }
    }

    ContractStore.update((store) => {
      store.ousdExchangeRates = { ...ousdExchangeRates }
    })
  }

  if (window.fetchInterval) {
    clearInterval(fetchInterval)
  }

  const callWithDelay = () => {
    setTimeout(async () => {
      fetchExchangeRates()
      const apr = await viewVault.getAPR()
      ContractStore.update((s) => {
        s.apr = parseFloat(ethers.utils.formatUnits(apr, 18))
      })
    }, 2)
  }

  callWithDelay()
  // execute in parallel and repeat in an interval
  window.fetchInterval = setInterval(() => {
    callWithDelay()
  }, 5000)

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
