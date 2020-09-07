const networkInfo = {
  1: 'Mainnet',
  3: 'Ropsten',
  4: 'Rinkeby',
  5: 'Goerli',
  42: 'Kovan',
  31337: 'Localhost',
  1337: 'Localhost - Mainnet Fork',
}

export function isCorrectNetwork(web3React) {
  if (process.env.NODE_ENV === 'production') {
    return web3React.chainId === 1
  } else if (process.env.NODE_ENV === 'development') {
      return web3React.chainId === 1337 || web3React.chainId === 31337
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
