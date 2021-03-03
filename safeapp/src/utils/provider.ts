import { ethers, Contract, BigNumber } from 'ethers'

const getNetworkProvider = async (safe:any) => {
  const account = safe.safeAddress
  if (!account || !account.length) {
    return
  }
  if (!safe) {
    return
  }
  const networkName = safe.network
  let network;
  try {
    network = require(`../../network.${networkName.toLowerCase()}.json`)
  } catch (e) {
    console.error('network.json file not present')
    // contract addresses not present no need to continue initialisation
    return
  }

  // without an account logged in contracts are initialized with JsonRpcProvider and
  // can operate in a read-only mode
  const provider = new ethers.providers.JsonRpcProvider(
    process.env[`REACT_APP_${networkName}_RPC_HTTP_URL`],
    { name: networkName, chainId: parseInt(network.chainId) }
  )

  return {account, network, provider}
}

export default getNetworkProvider;
