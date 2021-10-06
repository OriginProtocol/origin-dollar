import { InjectedConnector } from '@web3-react/injected-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { LedgerConnector } from './LedgerConnector'
import { MewConnectConnector } from '@myetherwallet/mewconnect-connector'

import { providerName } from 'utils/web3'

const POLLING_INTERVAL = 12000
const RPC_HTTP_URLS = {
  1: process.env.RPC_HTTP_URL_1,
  4: process.env.RPC_HTTP_URL_4,
}
const RPC_WS_URLS = {
  1: process.env.RPC_WS_URL_1,
  4: process.env.RPC_WS_URL_4,
}

const getChainId = () => {
  if (process.env.NODE_ENV === 'production') {
    return 1
  } else if (process.env.NODE_ENV === 'development') {
    return process.env.MAINNET_FORK ? 1 : 31337
  }
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 31337],
})

export const ledger = new LedgerConnector({
  chainId: getChainId(),
  url: RPC_HTTP_URLS[1],
  pollingInterval: POLLING_INTERVAL,
})

export const mewConnect = new MewConnectConnector({
  url: RPC_WS_URLS[1],
})

export const walletConnect = new WalletConnectConnector({
  rpc: {
    // Note: WalletConnect Connector doesn't work
    // with networks other than mainnet
    1: RPC_HTTP_URLS[1],
  },
  pollingInterval: POLLING_INTERVAL,
})

// Clear WalletConnect's state on disconnect
walletConnect.on('disconnect', () => {
  console.log('Cleaning up...')
  delete localStorage.walletconnect
})

export const getConnectorImage = (activeConnector) => {
  if (activeConnector.connector === ledger) {
    return 'ledger-icon.svg'
  } else if (activeConnector.connector === mewConnect) {
    return 'mew-icon.svg'
  } else if (activeConnector.connector === walletConnect) {
    return 'walletconnect-icon.svg'
  } else {
    const prName = providerName()
    if (prName === 'metamask') {
      return 'metamask-icon.svg'
    }
  }

  return 'default-wallet-icon.svg'
}

export const getConnector = (connector) => {
  const connectorInfo = Object.values(connectorsByName).filter(
    (conInfo) => conInfo.connector === connector
  )[0]
  if (!connectorInfo) {
    console.warn('Unrecognized connector ', connector)
  }
  return connectorInfo
}

export const connectorsByName = {
  MetaMask: {
    connector: injected,
    displayName: 'MetaMask',
    fileName: 'metamask',
  },
  Ledger: {
    connector: ledger,
    displayName: 'Ledger',
    fileName: 'ledger',
  },
  MEW: {
    connector: mewConnect,
    displayName: 'MEW wallet',
    fileName: 'mew',
  },
  WalletConnect: {
    connector: walletConnect,
    displayName: 'WalletConnect',
    fileName: 'walletconnect',
  },
}
