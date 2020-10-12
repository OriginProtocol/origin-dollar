import React, { useEffect, useState } from 'react'
const ethers = require('ethers')

import TransactionStore from 'stores/TransactionStore'
import { useStoreState } from 'pullstate'

const withRpcProvider = (WrappedComponent) => {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ETHEREUM_RPC_PROVIDER,
    { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) }
  )

  const Wrapper = (props) => {
    const dirtyTransactions = useStoreState(
      TransactionStore,
      (s) => s.dirtyTransactions
    )

    const storeTransactionError = async (type, coins) => {
      const lastBlockNr = await provider.getBlockNumber()

      TransactionStore.update((s) => {
        s.dirtyTransactions = [
          ...dirtyTransactions,
          {
            hash: Math.random().toString(), // just for deduplication purposes
            type,
            coins,
            mined: true,
            isError: true,
            blockNumber: lastBlockNr,
          },
        ]
      })
    }

    const storeTransaction = (txReceipt, type, coins, data = {}) => {
      TransactionStore.update((s) => {
        s.dirtyTransactions = [
          ...dirtyTransactions,
          {
            hash: txReceipt.hash,
            from: txReceipt.from,
            chainId: txReceipt.chainId,
            nonce: txReceipt.nonce,
            type,
            coins,
            data,
            isError: false,
            mined: false,
          },
        ]
      })
    }

    return (
      <WrappedComponent
        {...props}
        rpcProvider={provider}
        storeTransaction={storeTransaction}
        storeTransactionError={storeTransactionError}
      />
    )
  }

  if (WrappedComponent.getInitialProps) {
    Wrapper.getInitialProps = async (ctx) => {
      const componentProps = await WrappedComponent.getInitialProps(ctx)
      return componentProps
    }
  }
  return Wrapper
}

export default withRpcProvider
