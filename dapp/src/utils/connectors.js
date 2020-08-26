import { InjectedConnector } from '@web3-react/injected-connector'
import { LedgerConnector } from '@web3-react/ledger-connector'


const POLLING_INTERVAL = 12000
const RPC_URLS = {
  1: process.env.RPC_URL_1,
  4: process.env.RPC_URL_4
}

const nodeEnvToChainId = {
  'production': 1,
  'development': 31337
}

export const injected = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 31337],
})

export const ledger = new LedgerConnector({
	chainId: nodeEnvToChainId[process.env.NODE_ENV],
  url: RPC_URLS[1],
  pollingInterval: POLLING_INTERVAL
})

export const connectorsByName = {
  Metamask: {
    connector: injected,
    icon: 'metamask-icon.svg'
  },
  Ledger: {
    connector: ledger,
    icon: 'ledger-icon.svg'
  }
}
