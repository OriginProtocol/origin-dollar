import { InjectedConnector } from '@web3-react/injected-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { MewConnectConnector } from '@myetherwallet/mewconnect-connector'
import { SafeAppConnector } from '@gnosis.pm/safe-apps-web3-react'

import { providerName } from 'utils/web3'

const POLLING_INTERVAL = 12000
export const RPC_HTTP_URLS = {
  1: process.env.RPC_HTTP_URL_1,
  4: process.env.RPC_HTTP_URL_4,
}
export const RPC_WS_URLS = {
  1: process.env.RPC_WS_URL_1,
  4: process.env.RPC_WS_URL_4,
}

export const getChainId = () => {
  if (process.env.NODE_ENV === 'production') {
    return 1
  } else if (process.env.NODE_ENV === 'development') {
    return process.env.MAINNET_FORK ? 1 : 31337
  }
}

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 31337],
})

export const gnosisConnector = () => {
  let gnosisConnectorCache
  if (!process.browser) return
  if (!gnosisConnectorCache) gnosisConnectorCache = new SafeAppConnector()
  return gnosisConnectorCache
}

export const myEtherWalletConnector = new MewConnectConnector({
  url: RPC_WS_URLS[1],
})

export const walletConnectConnector = new WalletConnectConnector({
  rpc: {
    // Note: WalletConnect Connector doesn't work
    // with networks other than mainnet
    1: RPC_HTTP_URLS[1],
  },
  pollingInterval: POLLING_INTERVAL,
})

// Clear WalletConnect's state on disconnect
walletConnectConnector.on('disconnect', () => {
  console.log('Cleaning up...')
  delete localStorage.walletconnect
})
