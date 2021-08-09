import { ConnectorUpdate } from '@web3-react/types'
import { AbstractConnector } from '@web3-react/abstract-connector'
import Web3ProviderEngine from 'web3-provider-engine'
import { ledgerEthereumBrowserClientFactoryAsync } from '@0x/subproviders/lib/src' // https://github.com/0xProject/0x-monorepo/issues/1400
import { LedgerSubprovider } from '@0x/subproviders/lib/src/subproviders/ledger' // https://github.com/0xProject/0x-monorepo/issues/1400
import CacheSubprovider from 'web3-provider-engine/subproviders/cache.js'
import { RPCSubprovider } from '@0x/subproviders/lib/src/subproviders/rpc_subprovider' // https://github.com/0xProject/0x-monorepo/issues/1400

const LEDGER_LIVE_BASE_PATH = "44'/60'/0'/0"
const LEDGER_CHROME_BASE_PATH = "44'/60'/0'"
const MEW_BASE_PATH = "44'/60'/0"

function notZero(v) {
  return !['0x0', '0', 0, '0x00'].includes(v)
}

function getRPCProvider(providers) {
  for (const provider of providers) {
    if (typeof provider._rpcUrl !== 'undefined') {
      return provider
    }
  }
  return null
}

/**
 * Adapted from @web3-react's LedgerConnector with ways to
 * figure out which derivation path to use.
 *
 * Ref: https://github.com/NoahZinsmeister/web3-react/blob/v6/packages/ledger-connector/src/index.ts
 * Ref: https://github.com/MyCryptoHQ/MyCrypto/issues/2070
 *
 * TODO: Add support for multiple accounts and not just the first? The path
 * prefix is not the only difference, either.  Live uses `m/44'/60'/x'/0/0`
 * and I think LedgerSubprovider assumes the appended path is `x` (e.g.
 * `m/44'/60'/0'/0/x`)
 */
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
    this.engine = null
  }

  async activate() {
    if (!this.provider) {
      this.engine = new Web3ProviderEngine({
        pollingInterval: this.pollingInterval,
      })

      this.engine.addProvider(new CacheSubprovider())
      this.engine.addProvider(
        new RPCSubprovider(this.url, this.requestTimeoutMs)
      )

      // Figure out which Ledger provider we want
      const provider = await this.deriveProvider({
        networkId: this.chainId,
        ledgerEthereumClientFactoryAsync: ledgerEthereumBrowserClientFactoryAsync,
        accountFetchingConfigs: this.accountFetchingConfigs,
      })

      // addProvider doesn't seem to work with index?
      // this.engine.addProvider(provider, 0)
      // So we'll do it manually
      this.engine._providers.splice(0, 0, provider)

      this.provider = this.engine
    }

    this.provider.start()

    return { provider: this.provider, chainId: this.chainId }
  }

  createProvider(providerOpts) {
    const subprovider = new LedgerSubprovider(providerOpts)
    subprovider.setEngine(this.engine)
    return subprovider
  }

  async deriveProvider(providerOpts) {
    const providers = {
      // Derivation used by Ledger Live
      liveProvider: this.createProvider({
        ...providerOpts,
        baseDerivationPath: LEDGER_LIVE_BASE_PATH,
      }),
      // Derivation used by the old Ledger chrome app
      legacyProvider: this.createProvider({
        ...providerOpts,
        baseDerivationPath: LEDGER_CHROME_BASE_PATH,
      }),
    }

    try {
      for (const key of Object.keys(providers)) {
        const subprovider = providers[key]
        const account = await this._getFirstAccount(subprovider)
        const accountBalance = await this._getBalance(account)
        if (notZero(accountBalance)) {
          return subprovider
        }
      }
    } catch (err) {
      // We'll fallback to default so noop here
      console.warn(err)
    }

    console.debug(
      'Falling back to default Ledger provider (no funded account found)'
    )

    // Default to the newer Ledger Live derivation path
    return providers.liveProvider
  }

  async getProvider() {
    return this.provider
  }

  async getChainId() {
    return this.chainId
  }

  async _getBalance(account) {
    const rpcSubprovider = getRPCProvider(this.engine._providers)
    const JSONRequest = {
      id: 123,
      method: 'eth_getBalance',
      params: [account, 'latest'],
    }
    return new Promise((resolve, reject) => {
      rpcSubprovider.handleRequest(JSONRequest, null, (err, resp) => {
        if (err) return reject(err)
        resolve(resp)
      })
    })
  }

  async _getFirstAccount(subprovider) {
    const accounts = await subprovider.getAccountsAsync(1)
    return !!accounts ? accounts[0] : null
  }

  async getAccount() {
    return this._getFirstAccount(this.provider._providers[0])
  }

  deactivate() {
    this.provider.stop()
  }
}
