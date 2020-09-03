import React, { Component } from 'react'
import ethers from 'ethers'
import { useStoreState } from 'pullstate'

import { TransactionStore, initialState } from 'stores/TransactionStore'
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
      // transactions for which we have already initiated functions that wait for their completion
      transactionsObserved: [],
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

    if (account === undefined) return

    if (account !== prevProps.account) {
      this.clearStore()
      this.load()
    }

    if (this.props.dirtyTransactions.length > 0) {
      TransactionStore.update((s) => {
        s.dirtyTransactions = []
      })
      this.observeTransactions(this.props.dirtyTransactions)
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

  return (
    <TransactionListener
      account={account}
      transactions={transactions}
      dirtyTransactions={dirtyTransactions}
      rpcProvider={rpcProvider}
    />
  )
}

export default withRpcProvider(TransactionListenerWrapper)
