import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import TransactionStore from 'stores/TransactionStore'
import { currencies } from 'constants/Contract'

const ApproveCurrencyInProgressModal = ({ show }) => {
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const approveContractTypes = Object.keys(currencies).map(
    (c) => `approve-${c}`
  )
  const pendingApprovalTransactions = transactions.filter(
    (tx) => approveContractTypes.includes(tx.type) && !tx.mined
  )
  const pendingApprovalCoins = pendingApprovalTransactions.map((pat) =>
    pat.type.substr(pat.type.indexOf('-') + 1)
  )
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)

  if (pendingApprovalTransactions.length === 0) {
    return ''
  }

  return (
    <>
      <div className="approve-modal d-flex">
        <div
          className="modal-body shadowed-box d-flex flex-column"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="body-coins d-flex flex-column">
            <img className="login-icon" src={`/images/${connectorIcon}`} />
            <h2>
              {fbt(
                'Waiting for ' +
                  fbt.param(
                    'coins-name',
                    pendingApprovalCoins.join(', ').toUpperCase()
                  ) +
                  ' to be approved',
                'Waiting for coin to be approved'
              )}
            </h2>
          </div>
        </div>
      </div>
      <style jsx>{`
        .approve-modal {
          position: absolute;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: rgba(250, 251, 252, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 10;
          padding-left: 160px;
          padding-right: 160px;
        }

        .approve-modal h2 {
          font-size: 18px;
          text-align: center;
          color: #183140;
        }

        .modal-body {
          background-color: white;
          place-self: center;
          padding: 0px;
        }

        .body-coins {
          padding: 20px;
        }

        .login-icon {
          height: 50px;
          margin-bottom: 20px;
        }
      `}</style>
    </>
  )
}

export default ApproveCurrencyInProgressModal
