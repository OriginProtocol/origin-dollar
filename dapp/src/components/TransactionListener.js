import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useStoreState } from 'pullstate'

import TransactionStore, { initialState } from 'stores/TransactionStore'
import ContractStore from 'stores/ContractStore'
import { usePrevious } from 'utils/hooks'
import { useWeb3React } from '@web3-react/core'
import withRpcProvider from 'hoc/withRpcProvider'
import { sleep } from 'utils/utils'

/**
 * Currently we do not have a centralised solution to fetch all the events
 * between a user account and our contracts. For that reason client stores all
 * transaction hashes to localStorage. The ones that have not yet been mined
 * are observed and once mined the data in local storage is updated.
 *
 * If user clears localStorage data or uses a different device the history
 * shall not be present.
 */
const TransactionListener = ({ rpcProvider }) => {
  const { connector, account } = useWeb3React()
  const [wsProvider, setWsProvider] = useState(null)

  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const dirtyTransactions = useStoreState(
    TransactionStore,
    (s) => s.dirtyTransactions
  )
  const transactionHashesToDismiss = useStoreState(
    TransactionStore,
    (s) => s.transactionHashesToDismiss
  )

  useEffect(() => {
    clearStore()
    load()
  }, [account])

  useEffect(() => {
    if (account === undefined) {
      TransactionStore.update((s) => {
        s.transactions = []
      })
      return
    }

    if (dirtyTransactions.length > 0) {
      TransactionStore.update((s) => {
        s.dirtyTransactions = []
      })
      observeTransactions(dirtyTransactions)
    } else if (transactionHashesToDismiss.length > 0) {
      const newTransactions = TransactionStore.currentState.transactions.filter(
        (tx) => !transactionHashesToDismiss.includes(tx.hash)
      )
      TransactionStore.update((s) => {
        s.transactionHashesToDismiss = []
        s.transactions = newTransactions
      })
      save(newTransactions)
    }

    const nonMinedTx = TransactionStore.currentState.transactions.filter(
      (t) => !t.mined
    )
    if (nonMinedTx.length > 0 && !wsProvider) {
      startWebsocketListener()
    } else if (nonMinedTx.length === 0 && wsProvider) {
      cleanupWebSocketProvider()
    }

    return () => cleanupWebSocketProvider()
  }, [
    transactions,
    dirtyTransactions,
    transactionHashesToDismiss,
    account,
    wsProvider,
  ])

  /* We have a pending transaction so we start listening for mint / redeem
   * events and if a transaction with a new hash from the same account and the
   * same nonce arrives we know user has dropped and replaced a transaction
   * with a higher gas price one.
   */
  const startWebsocketListener = async () => {
    const wsProvider = new ethers.providers.WebSocketProvider(
      process.env.ETHEREUM_WEBSOCKET_PROVIDER
    )

    const vault = ContractStore.currentState.contracts.vault
    const ousd = ContractStore.currentState.contracts.ousd

    const handlePossibleReplacedTransaction = async (eventTransactionHash) => {
      const eventTx = await wsProvider.getTransaction(eventTransactionHash)

      if (eventTx.from.toUpperCase() === account.toUpperCase()) {
        const nonMinedTx = TransactionStore.currentState.transactions.filter(
          (t) => !t.mined
        )

        nonMinedTx
          .filter((tx) => tx.nonce)
          .forEach(async (tx) => {
            // same nonce detected transaction has been dropped and replaced
            if (tx.nonce === eventTx.nonce) {
              const otherTransactions =
                TransactionStore.currentState.transactions.filter(
                  (t) => t.hash !== tx.hash
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
              save(newTransactions)
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

    wsProvider.on(ousd.filters.TotalSupplyUpdatedHighres(), (log, event) => {
      handlePossibleReplacedTransaction(log.transactionHash)
    })

    setWsProvider(wsProvider)
  }

  /*
   * Remove WS provider and listeners
   */
  const cleanupWebSocketProvider = () => {
    if (wsProvider) {
      const vault = ContractStore.currentState.contracts.vault
      wsProvider.removeAllListeners(vault.filters.Redeem())
      wsProvider.removeAllListeners(vault.filters.Mint())
      setWsProvider(null)
    }
  }

  const updateTransactions = (transactionsToUpdate) => {
    const txHashes = transactionsToUpdate.map((t) => t.hash)
    /* With functional approach values inside a function scope can be out of date
     * and there are race conditions where later executions can override previous ones.
     * For that reason `TransactionStore.currentState` approach is mandatory
     */
    const otherTxs = TransactionStore.currentState.transactions.filter(
      (tx) => !txHashes.includes(tx.hash)
    )
    const newTransactions = [...otherTxs, ...transactionsToUpdate]
    TransactionStore.update((s) => {
      s.transactions = newTransactions
    })
    save(newTransactions)
  }

  const localStorageId = (account) => {
    return `transaction-store-${account}`
  }

  const clearStore = () => {
    TransactionStore.update((s) => {
      Object.keys(initialState).forEach((key) => {
        s[key] = initialState[key]
      })
    })
  }

  /**
   * Load transaction data from local storage
   */
  const load = () => {
    const storageTransactions = JSON.parse(
      localStorage.getItem(localStorageId(account)) || '[]'
    ).map((tx) => {
      // reset the flag in case the dapp has been closed mid observation of a tx the last time
      tx.observed = false
      return tx
    })

    TransactionStore.update((s) => {
      s.transactions = storageTransactions
    })

    setTimeout(async () => await observeTransactions(storageTransactions), 1)
  }

  /**
   * Save transaction data to local storage.
   */
  const save = (transactions) => {
    localStorage.setItem(localStorageId(account), JSON.stringify(transactions))
  }

  const observeTransaction = async (transaction) => {
    const observableHash = transaction.safeData
      ? transaction.safeData.txHash
      : transaction.hash

    try {
      const receipt = await rpcProvider.waitForTransaction(observableHash)

      // For a Gnosis safe transaction to the receipt to address should match
      // the current account, otherwise the receipt from address
      const sourceAccount = transaction.safeData
        ? receipt.to.toLowerCase()
        : receipt.from.toLowerCase()

      if (sourceAccount !== account.toLowerCase()) {
        console.warn(
          `Transaction receipt belongs to ${sourceAccount} account, but current selected account is ${account}. Can not confirm a mined transaction.`
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

      updateTransactions([newTx])

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

  const observeTransactions = async (transactionsToCheck) => {
    const resolvedTransactions = await Promise.all(
      transactionsToCheck.map(async (t) => {
        if (!t.isSafe) return t
        // If this was a Gnosis Safe transaction, we have a SafeTxHash not a
        // real transaction hash. We need to resolve some additional data about
        // the transaction using the Gnosis Safe SDK.
        let safeData
        // TODO handle a 404 here. We need to retry. A refresh is required to
        // get this to retry at the moment.
        try {
          safeData = await connector.sdk.txs.getBySafeTxHash(t.hash)
        } catch (e) {
          console.error('Gnosis safe SDK call failed: ', e)
        }
        return {
          ...t,
          safeData,
        }
      })
    )

    // Transactions awaiting mining
    const nonMinedTx = resolvedTransactions
      .filter((t) => {
        if (!t.mined && !t.observed) {
          // Multisig success states
          if (t.safeData)
            return ['AWAITING_EXECUTION', 'SUCCESS'].includes(
              t.safeData.txStatus
            )
          return true
        }
        return false
      })
      .map((t) => ({ ...t, observed: true }))

    // Transactions that have errored
    const errorTx = resolvedTransactions.filter((t) => {
      if (t.isError) return true
      if (t.safeData) {
        return ['FAILED', 'CANCELLED', 'PENDING_FAILED'].includes(
          t.safeData.txStatus
        )
      }
      return false
    })

    if (nonMinedTx.length > 0) {
      updateTransactions(nonMinedTx)
      // Observe all unmined transactions
      await Promise.all(nonMinedTx.map(observeTransaction))
    }

    if (errorTx.length > 0) updateTransactions(errorTx)
  }

  return null
}

export default withRpcProvider(TransactionListener)
