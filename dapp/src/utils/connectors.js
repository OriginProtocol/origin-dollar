import { InjectedConnector } from '@web3-react/injected-connector'
import { LedgerConnector } from '@web3-react/ledger-connector'
import { WalletConnectConnector } from '@web3-react/walletconnect-connector'

const POLLING_INTERVAL = 12000
const RPC_URLS = {
  1: process.env.RPC_URL_1,
  4: process.env.RPC_URL_4,
}

const getChainId = () => {
  if (process.env.NODE_ENV === 'production') {
    return 1
  } else if (process.env.NODE_ENV === 'development') {
    if (process.env.MAINNET_FORK === 'true') {
      return 1337
    } else {
      return 31337
    }
  }
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 1337, 31337],
})

// This is the newer style Ledger Live derivation path
// Ref: https://github.com/oplabs/origin-dollar/issues/21
const baseDerivationPath = "44'/60'/0'/0"
export const ledger = new LedgerConnector({
  chainId: getChainId(),
  url: RPC_URLS[1],
  pollingInterval: POLLING_INTERVAL,
  baseDerivationPath,
})

export const walletConnect = new WalletConnectConnector({
  rpc: {
    // Note: WalletConnect Connector doesn't work
    // with networks other than mainnet
    1: RPC_URLS[1],
  },
  pollingInterval: POLLING_INTERVAL,
})

export const connectorsByName = {
  Metamask: {
    connector: injected,
    icon: 'metamask-icon.svg',
  },
  Ledger: {
    connector: ledger,
    icon: 'ledger-icon.svg',
  },
  WalletConnect: {
    connector: walletConnect,
    icon: 'walletconnect-icon.svg',
  },
}
