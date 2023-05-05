import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import SidePanelWelcomeMessage from 'components/transactionActivity/SidePanelWelcomeMessage'
import SidePanelTransactionMessage from 'components/transactionActivity/SidePanelTransactionMessage'
// import SidePanelInsuranceMessage from 'components/transactionActivity/SidePanelInsuranceMessage'
import TransactionStore from 'stores/TransactionStore'
import { usePrevious } from 'utils/hooks'
import ContractStore from 'stores/ContractStore'
import { fbt } from 'fbt-runtime'

const TransactionActivity = () => {
  const showingAllContracts = useStoreState(
    ContractStore,
    (s) => s.showAllContracts
  )
  const approvalNeeded = useStoreState(ContractStore, (s) => s.approvalNeeded)
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const prevTransactions = usePrevious(transactions)
  const [txHashesToAnimate, setTxHashesToAnimate] = useState([])
  const [sortedTransactions, setSortedTransactions] = useState([])

  useEffect(() => {
    // check which transactions have newly arrived
    if (prevTransactions && prevTransactions.length !== 0) {
      const prevTxHashes = prevTransactions.map((tx) => tx.hash)
      setTxHashesToAnimate([
        ...txHashesToAnimate,
        ...transactions
          .filter((tx) => !prevTxHashes.includes(tx.hash))
          .map((tx) => tx.hash),
      ])
    }

    const sortedTx = [...transactions]
    /* need to create a separate array from `transactions` one, otherwise the
     * useEffect with the sorted `transactions` as second parameters triggers
     * on each render.
     */
    sortedTx.sort((a, b) => {
      if (!b.mined && !a.mined) return 0
      else if (!b.mined) return 10
      else if (!a.mined) return -10
      else return b.blockNumber - a.blockNumber
    })
    const filteredTx = sortedTx.filter((tx) => {
      return (
        tx.type !== 'approveWrap' && tx.type !== 'wrap' && tx.type !== 'unwrap'
      )
    })
    setSortedTransactions(filteredTx)
  }, [transactions])

  return (
    <>
      <div
        className={`transaction-activity d-flex flex-column justify-content-start align-items-center`}
      >
        <div className="transaction-header">
          <h2 className="title">{fbt('Recent activity', 'Recent activity')}</h2>
        </div>
        <div className="transaction-messages disable-scrollbars">
          {sortedTransactions && sortedTransactions.length > 0 ? (
            sortedTransactions.map((tx) => (
              <SidePanelTransactionMessage
                key={tx.hash}
                transaction={tx}
                animate={txHashesToAnimate.includes(tx.hash)}
              />
            ))
          ) : (
            <span className="no-activity">
              {fbt('No transaction activity', 'No activity')}
            </span>
          )}
        </div>
      </div>
      <style jsx>{`
        .transaction-activity {
          position: absolute;
          right: 0;
          max-width: 374px;
          min-width: 290px;
          border-radius: 10px;
          background-color: #1e1f25;
          border: 1px solid #141519;
          flex-grow: 1;
          max-height: 550px;
          overflow: hidden;
        }

        .transaction-header {
          display: flex;
          align-center: center;
          position: sticky;
          top: -1px;
          justify-content: space-between;
          padding: 24px 20px;
          border-bottom: 1px solid #141519;
          width: 100%;
        }

        .transaction-header .title {
          color: #fafbfb;
          font-size: 14px;
        }

        .transaction-messages {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          height: 100%;
          width: 100%;
          max-height: 440px;
          overflow-y: scroll;
        }

        .transaction-messages .no-activity {
          color: #828699;
          font-size: 14px;
          text-align: left;
          padding: 15px 20px;
        }

        .disable-scrollbars::-webkit-scrollbar {
          width: 0px;
          background: transparent; /* Chrome/Safari/Webkit */
        }

        .disable-scrollbars {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE 10+ */
        }
      `}</style>
    </>
  )
}

export default TransactionActivity
