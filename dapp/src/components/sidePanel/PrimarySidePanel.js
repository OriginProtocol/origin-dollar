import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import SidePanelMessage from 'components/sidePanel/SidePanelMessage'
import SidePanelTransactionMessage from 'components/sidePanel/SidePanelTransactionMessage'
import { TransactionStore } from 'stores/TransactionStore'
import { usePrevious } from 'utils/hooks'

const PrimarySidePanel = () => {
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

    setSortedTransactions(sortedTx)
  }, [transactions])

  return (
    <>
      <div
        id="primarySidePanel"
        className="sidepanel-wrapper collapse navbar-collapse"
      >
        <div className="primary-side-panel d-flex flex-column justify-content-start align-items-center">
          <button
            className="close navbar-toggler d-md-none"
            type="button"
            data-toggle="collapse"
            data-target="#primarySidePanel"
            aria-controls="primarySidePanel"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <img src="/images/close.svg" alt="Close icon" loading="lazy" />
          </button>

          {sortedTransactions.map((tx) => (
            <SidePanelTransactionMessage
              key={tx.hash}
              transaction={tx}
              animate={txHashesToAnimate.includes(tx.hash)}
            />
          ))}
          <SidePanelMessage />
        </div>
      </div>
      <style jsx>{`
        .primary-side-panel {
          margin-left: 20px;
          padding: 10px;
          max-width: 374px;
          min-width: 290px;
          min-height: 720px;
          max-height: 720px;
          border-radius: 10px;
          background-color: #fafbfc;
          border: 1px solid #cdd7e0;
          overflow-y: scroll;
          flex-grow: 1;
        }

        @media (min-width: 800px) {
          .collapse {
            display: block !important;
          }
        }

        @media (max-width: 799px) {
          .sidepanel-wrapper {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 100%;
            z-index: 1000;
            transition: all 0.3s ease;
          }

          .primary-side-panel {
            height: 100%;
            border-radius: 0;
            width: 320px;
            max-width: 320px;
            margin: 0;
            padding-top: 74px;
          }

          .navbar-collapse.collapsing {
            transition: all 0.3s ease;
            display: block;
            height: 100%;
          }

          .navbar-collapse.show {
            left: calc(100% - 320px);
          }

          .close {
            background: none;
            border: none;
            position: absolute;
            top: 30px;
            right: 30px;
          }
        }
      `}</style>
    </>
  )
}

export default PrimarySidePanel
