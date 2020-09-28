const networkInfo = {
  1: 'Mainnet',
  3: 'Ropsten',
  4: 'Rinkeby',
  5: 'Goerli',
  42: 'Kovan',
  31337: 'Localhost',
  1337: 'Localhost - Mainnet Fork',
}

export function isCorrectNetwork(chainId) {
  const envChainId = Number(process.env.ETHEREUM_RPC_CHAIN_ID)
  if (!Number.isNaN(envChainId)) {
    return chainId === envChainId
  }

  if (process.env.NODE_ENV === 'production') {
    return chainId === 1
  } else if (process.env.NODE_ENV === 'development') {
    return chainId === 1337 || chainId === 31337
  }
}

export function getEtherscanHost(web3React) {
  const chainIdToEtherscan = {
    1: 'https://etherscan.io',
    3: 'https://ropsten.etherscan.io',
    4: 'https://rinkeby.etherscan.io',
  }

  if (chainIdToEtherscan[web3React.chainId]) {
    return chainIdToEtherscan[web3React.chainId]
  } else {
    // by default just return mainNet url
    return chainIdToEtherscan[1]
  }
}

export function networkIdToName(chainId) {
  return networkInfo[chainId]
}

export function truncateAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function providerName() {
  const { ethereum = {}, web3 = {} } = window

  if (ethereum.isMetaMask) {
    return 'metamask'
  }

  if (ethereum.isImToken) {
    return 'imtoken'
  }

  if (typeof window.__CIPHER__ !== 'undefined') {
    return 'cipher'
  }

  if (!web3.currentProvider) {
    return null
  }

  if (web3.currentProvider.isToshi) {
    return 'coinbase'
  }

  if (web3.currentProvider.isTrust) {
    return 'trust'
  }

  if (web3.currentProvider.isGoWallet) {
    return 'gowallet'
  }

  if (web3.currentProvider.isAlphaWallet) {
    return 'alphawallet'
  }

  if (web3.currentProvider.isStatus) {
    return 'status'
  }

  if (web3.currentProvider.constructor.name === 'EthereumProvider') {
    return 'mist'
  }

  if (web3.currentProvider.constructor.name === 'Web3FrameProvider') {
    return 'parity'
  }

  if (web3.currentProvider.host && web3.currentProvider.host.indexOf('infura') !== -1) {
    return 'infura'
  }

  if (web3.currentProvider.host && web3.currentProvider.host.indexOf('localhost') !== -1) {
    return 'localhost'
  }

  return 'unknown'
}
