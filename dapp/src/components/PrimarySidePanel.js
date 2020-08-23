import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import SidePanelMessage from 'components/SidePanelMessage'
import SidePanelTransactionMessage from 'components/SidePanelTransactionMessage'
import { TransactionStore } from 'stores/TransactionStore'

const PrimarySidePanel = () => {
  const transactions = useStoreState(TransactionStore, s => s.transactions)
  return <>
    <div className="primary-side-panel d-flex flex-column justify-content-start align-items-center">
      <SidePanelMessage />
      {transactions.map(tx => <SidePanelTransactionMessage
        key={tx.hash}
        transaction={tx}
      />)}
    </div>
    <style jsx>{`
      .primary-side-panel {
        margin-left: 20px;
        padding: 10px;
        width: 290px;
        height: 670px;
        border-radius: 10px;
        background-color: #f2f3f5;
        overflow-y: scroll;
      }
    `}</style>
  </>
}

export default PrimarySidePanel
