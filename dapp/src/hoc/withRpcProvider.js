import React, { useEffect, useState } from 'react'
const ethers = require('ethers')

import { TransactionStore } from 'stores/TransactionStore'
import { useStoreState } from 'pullstate'

const withRpcProvider = WrappedComponent => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_PROVIDER, { chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID) })

  const Wrapper = props => {
    const transactions = useStoreState(TransactionStore, s => s.transactions)

    const storeTransaction = (txReceipt, type) => {
      TransactionStore.update(s => {
        s.transactions = [...transactions, {
          hash: txReceipt.hash,
          from: txReceipt.from,
          chainId: txReceipt.chainId,
          type,
          mined: false
        }]
        s.dirty = true
      })
    }

    return (<WrappedComponent
      {...props}
      rpcProvider={provider}
      storeTransaction={storeTransaction}
    />)
  }

  if (WrappedComponent.getInitialProps) {
    Wrapper.getInitialProps = async ctx => {
      const componentProps = await WrappedComponent.getInitialProps(ctx)
      return componentProps
    }
  }
  return Wrapper
}

export default withRpcProvider
