import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import ApproveCurrencyRow from 'components/buySell/ApproveCurrencyRow'

const ApproveModal = ({ currenciesNeedingApproval, onClose, onFinalize }) => {
  const ousdBalance = useStoreState(AccountStore, s => s.balances['ousd'] || 0)

  return <>
    <div 
      className="approve-modal d-flex"
      onClick={onClose}
    >
      <div
        className="modal-body shadowed-box d-flex flex-column"
        onClick={e => {
          // so the modal doesn't close
          e.stopPropagation()
        }}
      >
        <div className="body-coins d-flex flex-column">
          <h2>{fbt('Approve & finalize transaction', 'Approve & finalize transaction')}</h2>
          <div className="currencies">
            {currenciesNeedingApproval.map((coin, index) => {
              return <ApproveCurrencyRow
                key={coin}
                coin={coin}
                isLast={currenciesNeedingApproval.length - 1 === index}
              />
            })}
          </div>
        </div>
        <div className="body-actions d-flex align-items-center justify-content-center">
          <a
            className="blue-btn d-flex align-items-center justify-content-center"
            onClick={ async e => {
              e.preventDefault()
              await onFinalize()
            }}
          >
            {fbt('Finalize', 'Finalize')}  
          </a>
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
        z-index: 1;
        padding-left: 110px;
        padding-right: 110px;
      }

      .approve-modal h2 {
        font-size: 18px;
        font-weight: bold;
        color: #1e313f;
        margin-bottom: 7px;
      }

      .modal-body {
        background-color: white;
        place-self: center;
        padding: 0px;
      }

      .body-coins {
        padding: 20px 20px 0px 20px;
      }

      .body-actions {
        min-height: 95px;
        background-color: #f2f3f5;
        border-radius: 0px 0px 10px 10px;
        border-top: solid 1px #cdd7e0;
      }

      .blue-btn {
        height: 50px;
        border-radius: 25px;
        background-color: #1a82ff;
        padding-left: 69px;
        padding-right: 69px;
        color: white;
        cursor: pointer;
        font-size: 18px;
      }

      .blue-btn:hover { 
        background-color: #0a72ef;
        text-decoration: none;
      }
    `}</style>
  </>
}

export default ApproveModal
  