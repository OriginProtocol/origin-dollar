import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

const SidePanelTransactionMessage = ({ transaction }) => {
  return <>
    <div className="side-panel-message">
      <div className="title">
        Transaction
      </div>
      <div className="text">
        Mined: {transaction.mined ? 'true' : 'false'} <br/>
        Type: {transaction.type} <br/>
        Block: {transaction.blockNumber ? transaction.blockNumber : 'N/A'} <br/>
      </div>
    </div>
    <style jsx>{`
      .side-panel-message {
        width: 270px;
        border-radius: 5px;
        border: solid 1px #cdd7e0;
        background-color: #ffffff;
        padding: 15px 20px;
        margin-bottom: 10px;
      }

      .side-panel-message .text {
        font-size: 14px;
        line-height: 1.36;
        color: #8293a4;
      }
    `}</style>
  </>
}

export default SidePanelTransactionMessage
