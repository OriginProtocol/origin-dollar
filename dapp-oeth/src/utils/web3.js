const networkInfo = {
  1: 'Mainnet',
  1337: 'Localhost',
}

export function isCorrectNetwork(chainId) {
  if (process.env.NODE_ENV === 'production') {
    return chainId === 1
  } else {
    return (
      chainId === parseInt(process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID) ||
      1337
    )
  }
}

export async function switchEthereumChain() {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x1' }],
  })
}

export function getEtherscanHost(chainId) {
  const chainIdToEtherscan = {
    1: 'https://etherscan.io',
  }

  if (chainIdToEtherscan[chainId]) {
    return chainIdToEtherscan[chainId]
  } else {
    // by default just return mainNet url
    return chainIdToEtherscan[1]
  }
}

export function shortenAddress(address, shorter = false) {
  if (!address || address.length < 10) {
    return address
  }

  return `${address.substring(0, 5)}...${
    !shorter ? address.substring(address.length - 5) : ''
  }`
}

export function networkIdToName(chainId) {
  return networkInfo[chainId]
}

export function truncateAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function trackOUSDInMetaMask(ousdAddress) {
  web3.currentProvider.sendAsync(
    {
      method: 'metamask_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: ousdAddress,
          symbol: 'OUSD',
          decimals: 18,
          image: 'https://ousd.com/images/ousd-token-icon.svg',
        },
      },
    },
    console.log
  )
}

/* status of token wallets and OUSD:
 * https://docs.google.com/spreadsheets/d/1bunkxBxfkAVz9C14vAFH8CZ53rImDNHTXp94AOEjpq0/edit#gid=1608902436
 */
export function providersNotAutoDetectingOUSD() {
  return ['metamask', 'trust', 'alphawallet', 'mist', 'parity']
}

export function providerName() {
  if (!process.browser) {
    return null
  }

  const { ethereum = {}, web3 = {} } = window

  if (ethereum.isMetaMask) {
    return 'metamask'
  } else if (ethereum.isImToken) {
    return 'imtoken'
  } else if (typeof window.__CIPHER__ !== 'undefined') {
    return 'cipher'
  } else if (!web3.currentProvider) {
    return null
  } else if (web3.currentProvider.isToshi) {
    return 'coinbase'
  } else if (web3.currentProvider.isTrust) {
    return 'trust'
  } else if (web3.currentProvider.isGoWallet) {
    return 'gowallet'
  } else if (web3.currentProvider.isAlphaWallet) {
    return 'alphawallet'
  } else if (web3.currentProvider.isStatus) {
    return 'status'
  } else if (web3.currentProvider.constructor.name === 'EthereumProvider') {
    return 'mist'
  } else if (web3.currentProvider.constructor.name === 'Web3FrameProvider') {
    return 'parity'
  } else if (
    web3.currentProvider.host &&
    web3.currentProvider.host.indexOf('infura') !== -1
  ) {
    return 'infura'
  } else if (
    web3.currentProvider.host &&
    web3.currentProvider.host.indexOf('localhost') !== -1
  ) {
    return 'localhost'
  }

  return 'unknown'
}
