import React, { useState, useEffect } from 'react'
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
const TransactionListener = ({ rpcProvider }) => {
  const { account, chainId, library } = useWeb3React()
  const previousAccount = usePrevious(account)
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const dirty = useStoreState(TransactionStore, (s) => s.dirty)

  // transactions for which we have already initiated functions that wait for their completion
  const [transactionsObserved, setTransactionsObserved] = useState([])
  /* Because of the async way `observeTransactions` waits for a transaction to complete the TransactionStore's
   * `transactions` that are fetches using a hook and are in the scope of the `observeTransactions` function
   * might already be out of date (another transaction could complete in the mean time). For that reason
   * this convoluted use of `transactionsToUpdate` array is used in conjunction with `useEffect` that
   * observes this array. Think of it as a buffer where new/updated transactions are stored and immediately
   * put inside `TransactionStore`.
   *
   * If they were put directly into the `TransactionStore` one of the transactions could be deleted
   * in case of a race condition.
   */
  const [transactionsToUpdate, setTransactionsToUpdate] = useState([])

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

  const load = () => {
    const storageTransactions = JSON.parse(
      localStorage.getItem(localStorageId(account)) || '[]'
    )
    TransactionStore.update((s) => {
      s.transactions = storageTransactions
    })
    observeTransactions(storageTransactions)
  }

  const save = (transactions) => {
    localStorage.setItem(localStorageId(account), JSON.stringify(transactions))
  }

  const observeTransaction = async (transaction) => {
    try {
      const receipt = await rpcProvider.waitForTransaction(transaction.hash)

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
      }

      // in development mode simulate transaction mining with 3 seconds delay
      if (process.env.NODE_ENV === 'development') {
        await sleep(3000)
      }

      setTransactionsToUpdate([...transactionsToUpdate, newTx])
      return receipt
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
    const observedHahes = transactionsObserved.map((tx) => tx.hash)
    const nonMinedTx = transactionsToCheck.filter(
      (t) => !t.mined && !observedHahes.includes(t.hash)
    )
    const result = await Promise.all(
      nonMinedTx.map((tx) => observeTransaction(tx))
    )
  }

  useEffect(() => {
    if (account !== undefined) {
      if (dirty) {
        save(transactions)
        TransactionStore.update((s) => {
          s.dirty = false
        })
        observeTransactions(transactions)
      }
    }
  }, [dirty, account])

  useEffect(() => {
    if (account !== undefined) {
      clearStore()
      load()
    }
  }, [account])

  useEffect(() => {
    if (transactionsToUpdate.length > 0) {
      const txToUpdateHashes = transactionsToUpdate.map((t) => t.hash)
      const otherTransactions = transactions.filter(
        (tx) => !txToUpdateHashes.includes(tx.hash)
      )

      const newTransactions = [...transactionsToUpdate, ...otherTransactions]
      TransactionStore.update((s) => {
        s.transactions = newTransactions
      })
      setTransactionsToUpdate([])
      save(newTransactions)
    }
  }, [transactionsToUpdate])

  return ''
}

export default withRpcProvider(TransactionListener)
