import React, { Component } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'

import TransactionStore, { initialState } from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import { usePrevious } from 'utils/hooks'
import { useWeb3React } from '@web3-react/core'
import withRpcProvider from 'hoc/withRpcProvider'
import { sleep } from 'utils/utils'

/**
 * Currently we do not have a centralised solition to fetch all the events between a user account and
 * our contracts. For that reason client stores all transaction hashes to localStorage. The ones that
 * have not yet been mined are observed and once mined the data in local storage is updated.
 *
 * If user clears localStorage data or uses a different device the history shall not be present.
 */
class TransactionListener extends Component {
  constructor(props) {
    super(props)

    this.state = {
      wsProvider: null,
    }
  }

  componentDidMount() {
    if (this.props.account) {
      this.clearStore()
      this.load()
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const account = this.props.account

    if (account === undefined) {
      TransactionStore.update((s) => {
        s.transactions = []
      })
      return
    }

    if (account !== prevProps.account) {
      this.clearStore()
      this.load()
    }

    if (this.props.dirtyTransactions.length > 0) {
      TransactionStore.update((s) => {
        s.dirtyTransactions = []
      })
      this.observeTransactions(this.props.dirtyTransactions)
    } else if (this.props.transactionHashesToDismiss.length > 0) {
      const newTransactions = this.props.transactions.filter(
        (tx) => !this.props.transactionHashesToDismiss.includes(tx.hash)
      )
      TransactionStore.update((s) => {
        s.transactionHashesToDismiss = []
        s.transactions = newTransactions
      })
      this.save(newTransactions)
    }

    const nonMinedTx = this.props.transactions.filter((t) => !t.mined)
    if (nonMinedTx.length > 0 && !this.state.wsProvider) {
      this.startWebsocketListener()
    } else if (nonMinedTx.length === 0 && this.state.wsProvider) {
      this.cleanupWebSocketProvider()
    }
  }

  componentWillUnmount() {
    this.cleanupWebSocketProvider()
  }

  /* We have a pending transaction so we start listenening for mint / redeem events
   * and if a transaction with a new hash from the same account and the same nonce arrives
   * we know user has dropped and replaced a transaction with a higher gas price one.
   */
  async startWebsocketListener() {
    const wsProvider = new ethers.providers.WebSocketProvider(
      process.env.ETHEREUM_WEBSOCKET_PROVIDER
    )
    const vault = ContractStore.currentState.contracts.vault
    const ousd = ContractStore.currentState.contracts.ousd

    const handlePossibleReplacedTransaction = async (eventTransactionHash) => {
      const eventTx = await wsProvider.getTransaction(eventTransactionHash)

      if (eventTx.from.toUpperCase() === this.props.account.toUpperCase()) {
        const nonMinedTx = this.props.transactions.filter((t) => !t.mined)

        nonMinedTx
          .filter((tx) => tx.nonce)
          .forEach(async (tx) => {
            // same nonce detected transaction has been dropped and replaced
            if (tx.nonce === eventTx.nonce) {
              const otherTransactions = this.props.transactions.filter(
                (txx) => txx.hash !== tx.hash
              )
              // do a copy otherwise pull state won't be happy
              const newTx = { ...tx }

              // change the necessary fields
              newTx.hash = eventTx.hash
              newTx.isError = false
              newTx.mined = true
              newTx.observed = false
              newTx.blockNumber = eventTx.blockNumber

              const newTransactions = [...otherTransactions, newTx]

              TransactionStore.update((s) => {
                s.transactions = newTransactions
              })
              this.save(newTransactions)
            }
          })
      }
    }

    wsProvider.on(vault.filters.Mint(), (log, event) => {
      handlePossibleReplacedTransaction(log.transactionHash)
    })

    wsProvider.on(vault.filters.Redeem(), (log, event) => {
      handlePossibleReplacedTransaction(log.transactionHash)
    })

    wsProvider.on(ousd.filters.TotalSupplyUpdated(), (log, event) => {
      handlePossibleReplacedTransaction(log.transactionHash)
    })

    this.setState({ wsProvider })
  }

  cleanupWebSocketProvider() {
    if (this.state.wsProvider) {
      const vault = ContractStore.currentState.contracts.vault

      this.state.wsProvider.removeAllListeners(vault.filters.Redeem())
      this.state.wsProvider.removeAllListeners(vault.filters.Mint())

      this.setState({
        wsProvider: null,
      })
    }
  }

  updateTransactions(transactions) {
    const txHashes = transactions.map((t) => t.hash)
    const otherTxs = this.props.transactions.filter(
      (tx) => !txHashes.includes(tx.hash)
    )
    const newTransactions = [...otherTxs, ...transactions]

    TransactionStore.update((s) => {
      s.transactions = newTransactions
    })

    this.save(newTransactions)
  }

  localStorageId(account) {
    return `transaction-store-${account}`
  }

  clearStore() {
    TransactionStore.update((s) => {
      Object.keys(initialState).forEach((key) => {
        s[key] = initialState[key]
      })
    })
  }

  load() {
    const storageTransactions = JSON.parse(
      localStorage.getItem(this.localStorageId(this.props.account)) || '[]'
    ).map((tx) => {
      // reset the flag in case the dapp has been closed mid observation of a tx the last time
      tx.observed = false
      return tx
    })

    TransactionStore.update((s) => {
      s.transactions = storageTransactions
    })

    // need to call it 1 frame later so that `transactions` props get populated
    setTimeout(async () => {
      await this.observeTransactions(storageTransactions)
    }, 1)
  }

  save(transactions) {
    localStorage.setItem(
      this.localStorageId(this.props.account),
      JSON.stringify(transactions)
    )
  }

  async observeTransaction(transaction) {
    try {
      const receipt = await this.props.rpcProvider.waitForTransaction(
        transaction.hash
      )
      const account = this.props.account

      if (receipt.from.toLowerCase() !== account.toLowerCase()) {
        console.warn(
          `Transaction receipt belongs to ${receipt.from} account, but current selected account is ${account}. Can not confirm a mined transaction.`
        )
        return
      }

      const newTx = {
        ...transaction,
        mined: true,
        blockNumber: receipt.blockNumber,
        observed: false,
        /* past Byzantium fork (October 2017 at block 4,370,000) transaction receipts have
         * a status parameter where 0 indicates some kind of error and 1 a success
         */
        isError: typeof receipt.status === 'number' && receipt.status === 0,
      }

      // in development mode simulate transaction mining with 3 seconds delay
      if (process.env.NODE_ENV === 'development') {
        await sleep(3000)
      }

      this.updateTransactions([newTx])

      return newTx
    } catch (e) {
      console.error(
        `Error while waiting for transaction ${JSON.stringify(
          transaction
        )} to be mined:`,
        e
      )
    }
  }

  async observeTransactions(transactionsToCheck) {
    const nonMinedTx = transactionsToCheck
      .filter((t) => !t.mined && !t.observed)
      .map((t) => {
        const newTx = { ...t }
        newTx.observed = true
        return newTx
      })

    if (nonMinedTx.length > 0) {
      this.updateTransactions(nonMinedTx)
      const updatedTransactions = await Promise.all(
        nonMinedTx.map((tx) => this.observeTransaction(tx))
      )
    }

    const errorTx = transactionsToCheck.filter((t) => t.isError)

    if (errorTx.length > 0) {
      this.updateTransactions(errorTx)
    }
  }

  render() {
    return ''
  }
}

//export default withRpcProvider(TransactionListener)

const TransactionListenerWrapper = ({ rpcProvider }) => {
  const { account } = useWeb3React()
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const dirtyTransactions = useStoreState(
    TransactionStore,
    (s) => s.dirtyTransactions
  )
  const transactionHashesToDismiss = useStoreState(
    TransactionStore,
    (s) => s.transactionHashesToDismiss
  )

  return (
    <TransactionListener
      account={account}
      transactions={transactions}
      dirtyTransactions={dirtyTransactions}
      transactionHashesToDismiss={transactionHashesToDismiss}
      rpcProvider={rpcProvider}
    />
  )
}

export default withRpcProvider(TransactionListenerWrapper)
