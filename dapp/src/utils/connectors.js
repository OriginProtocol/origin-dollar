import { InjectedConnector } from '@web3-react/injected-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'
import { WalletLinkConnector } from '@web3-react/walletlink-connector'
import { MewConnectConnector } from '@myetherwallet/mewconnect-connector'
import { SafeAppConnector } from '@gnosis.pm/safe-apps-web3-react'
import { LedgerConnector } from 'utils/LedgerConnector'
import { get } from 'lodash'
import { isProduction } from 'constants/env'

import { providerName } from 'utils/web3'

const POLLING_INTERVAL = 12000
const RPC_PROVIDER = process.env.ETHEREUM_RPC_PROVIDER
const WS_PROVIDER = process.env.ETHEREUM_WEBSOCKET_PROVIDER

export const injectedConnector = new InjectedConnector({
  supportedChainIds: [1, 1337],
})

export const gnosisConnector = () => {
  let gnosisConnectorCache
  if (!process.browser) return
  if (!gnosisConnectorCache) gnosisConnectorCache = new SafeAppConnector()
  return gnosisConnectorCache
}

export const myEtherWalletConnector = new MewConnectConnector({
  url: WS_PROVIDER,
})

export const walletConnectConnector = new WalletConnectConnector({
  rpc: {
    1: RPC_PROVIDER,
  },
  pollingInterval: POLLING_INTERVAL,
})

//coinbase
export const walletlink = new WalletLinkConnector({
  url: RPC_PROVIDER,
  supportedChainIds: [1, 1337],
})

export function resetWalletConnector(connector) {
  if (connector && connector instanceof WalletConnectConnector) {
    connector.walletConnectProvider = undefined
  }
}

// Clear WalletConnect's state on disconnect
walletConnectConnector.on('disconnect', () => {
  console.log('Cleaning up...')
  delete localStorage.walletconnect
})

export const ledgerConnector = new LedgerConnector({
  chainId: isProduction ? 1 : 1337,
  url: RPC_PROVIDER,
})

export const connectorNameIconMap = {
  MetaMask: 'metamask-icon.svg',
  Ledger: 'ledger-icon.svg',
  MyEtherWallet: 'myetherwallet-icon.svg',
  WalletConnect: 'walletconnect-icon.svg',
}

export const getConnectorIcon = (name) =>
  get(connectorNameIconMap, name, 'default-wallet-icon.svg')
