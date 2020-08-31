import ethers from 'ethers'

import ContractStore from 'stores/ContractStore'
import addresses from 'constants/contractAddresses'

import usdtAbi from 'constants/mainnetAbi/usdt.json'
import usdcAbi from 'constants/mainnetAbi/usdc.json'
import daiAbi from 'constants/mainnetAbi/dai.json'
import tusdAbi from 'constants/mainnetAbi/tusd.json'

let network
if (process.env.NODE_ENV === 'development') {
  if (process.env.MAINNET_FORK === 'true') {
    network = require('../../ganache-network.json')
  } else {
    network = require('../../network.json')
  }
}



export async function setupContracts(account, library) {
  if (!account) return

  let usdt, dai, tusd, usdc, ousd, vault
  if (process.env.NODE_ENV === 'development') {
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
      return new ethers.Contract(
        address,
        abi,
        library ? library.getSigner(account) : null)
    }

    const ousdProxy = contracts["OUSDProxy"]
    const vaultProxy = contracts["VaultProxy"]

    if (process.env.MAINNET_FORK === 'true') {
      usdt = getContract(addresses.mainnet.USDT, usdtAbi.abi)
      usdc = getContract(addresses.mainnet.USDC, usdcAbi.abi)
      dai = getContract(addresses.mainnet.DAI, daiAbi.abi)
      tusd = getContract(addresses.mainnet.TUSD, tusdAbi.abi)
      // ousd and vault are not yet deployed to mainnet
      ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
      vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
    } else {
      usdt = contracts["MockUSDT"]
      usdc = contracts["MockUSDC"]
      dai = contracts["MockDAI"]
      tusd = contracts["MockTUSD"]
      ousd = getContract(ousdProxy.address, network.contracts['OUSD'].abi)
      vault = getContract(vaultProxy.address, network.contracts['Vault'].abi)
    }
  } else {
    usdt = getContract(addresses.mainnet.USDT, usdtAbi)
    usdc = getContract(addresses.mainnet.USDC, usdcAbi)
    dai = getContract(addresses.mainnet.DAI, daiAbi)
    tusd = getContract(addresses.mainnet.TUSD, tusdAbi)

    throw new Error("ousd and vault are not yet deployed to mainnet")
    // ousd and vault are not yet deployed to mainnet
    // ousd = await ethers.getContractAt("OUSD", ousdProxy.address)
    // vault = await ethers.getContractAt("Vault", vaultProxy.address)
  }

  const contractToExport = {
    usdt,
    dai,
    tusd,
    usdc,
    ousd,
    vault
  }

  ContractStore.update((s) => {
    s.contracts = contractToExport
  })

  return contractToExport
}
