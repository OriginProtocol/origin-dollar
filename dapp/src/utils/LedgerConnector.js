import { ConnectorUpdate } from '@web3-react/types'
import { AbstractConnector } from '@web3-react/abstract-connector'
import Web3ProviderEngine from 'web3-provider-engine'
import { LedgerSubprovider } from '@0x/subproviders/lib/src/subproviders/ledger' // https://github.com/0xProject/0x-monorepo/issues/1400
import CacheSubprovider from 'web3-provider-engine/subproviders/cache.js'
import { RPCSubprovider } from '@0x/subproviders/lib/src/subproviders/rpc_subprovider' // https://github.com/0xProject/0x-monorepo/issues/1400
import TransportUSB from '@ledgerhq/hw-transport-webusb'
import EthApp from '@ledgerhq/hw-app-eth'

export class LedgerConnector extends AbstractConnector {
  constructor({
    chainId,
    url,
    pollingInterval,
    requestTimeoutMs,
    accountFetchingConfigs,
    baseDerivationPath,
  }) {
    super({ supportedChainIds: [chainId] })

    this.chainId = chainId
    this.url = url
    this.pollingInterval = pollingInterval
    this.requestTimeoutMs = requestTimeoutMs
    this.accountFetchingConfigs = accountFetchingConfigs
    this.baseDerivationPath = baseDerivationPath
  }

  async activate() {
    if (!this.provider) {
      const engine = new Web3ProviderEngine({
        pollingInterval: this.pollingInterval,
      })
      engine.addProvider(
        new LedgerSubprovider({
          networkId: this.chainId,
          ledgerEthereumClientFactoryAsync: async () =>
            new EthApp(await TransportUSB.create()),
          accountFetchingConfigs: this.accountFetchingConfigs,
          baseDerivationPath: this.baseDerivationPath,
        })
      )
      engine.addProvider(new CacheSubprovider())
      engine.addProvider(new RPCSubprovider(this.url, this.requestTimeoutMs))
      this.provider = engine
    }

    this.provider.start()

    return { provider: this.provider, chainId: this.chainId }
  }

  async getBalance(address) {
    return new Promise((resolve, reject) => {
      this.provider.sendAsync(
        {
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
        },
        (error, response) => {
          if (error) reject(error)
          else resolve(response.result)
        }
      )
    })
  }

  async getProvider() {
    return this.provider
  }

  async getChainId() {
    return this.chainId
  }

  async setPath(baseDerivationPath) {
    this.provider._providers[0].setPath(baseDerivationPath)
    this.baseDerivationPath = baseDerivationPath
    this._selectedAccount = undefined
    this.emitUpdate({ account: await this.getAccount() })
  }

  async getAccounts(limit) {
    return this.provider._providers[0].getAccountsAsync(limit)
  }

  setAccount(account) {
    this._selectedAccount = account
    this.emitUpdate({ account: this._selectedAccount })
  }

  async getAccount() {
    return (
      this._selectedAccount ||
      this.provider._providers[0]
        .getAccountsAsync(1)
        .then((accounts) => accounts[0])
    )
  }

  deactivate() {
    this.provider.stop()
  }
}
