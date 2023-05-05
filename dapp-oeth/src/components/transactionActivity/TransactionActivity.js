import React from 'react'
import SidePanelTransactionMessage from 'components/transactionActivity/SidePanelTransactionMessage'
import { fbt } from 'fbt-runtime'

const TransactionActivity = ({ transactions, animateHashes }) => {
  return (
    <>
      <div className="transaction-activity d-flex flex-column justify-content-start align-items-center">
        <div className="transaction-header">
          <h2 className="title">
            {fbt(
              `Recent activity ${fbt.param(
                'activity-count',
                `(${transactions?.length})`
              )}`,
              'Recent activity'
            )}
          </h2>
        </div>
        <div className="transaction-messages disable-scrollbars">
          {transactions && transactions.length > 0 ? (
            transactions.map((tx) => (
              <SidePanelTransactionMessage
                key={tx.hash}
                transaction={tx}
                animate={animateHashes.includes(tx.hash)}
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
          top: 50px;
          max-width: 374px;
          min-width: 374px;
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
          padding: 20px;
          border-bottom: 1px solid #141519;
          width: 100%;
        }

        .transaction-header .title {
          color: #fafbfb;
          font-size: 14px;
          margin: 0;
          padding: 0;
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
