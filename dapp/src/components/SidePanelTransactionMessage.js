import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'

const SidePanelTransactionMessage = ({ transaction, animate = false }) => {
  const isApproveTransaction = transaction.type === 'approve'
  const [showContents, setShowContents] = useState(!animate)
  const [showInnerContents, setShowInnerContents] = useState(false)
  const coin = transaction.coins

  useEffect(() => {
    if (animate) {
      setTimeout(() => {
        setShowContents(true)
      }, 100)

      setTimeout(() => {
        setShowInnerContents(true)
        // 700 is the 300 + 400 it takes for the .side-panel-message to animate
      }, 100 + 700)
    } else {
      setTimeout(() => {
        setShowInnerContents(true)
      }, 100)
    }
  }, [])

  return <>
    <div className={`side-panel-message ${animate ? 'animate' : ''}`}>
      <div className={`contents-body d-flex flex-column align-items-center ${showContents ? '' : 'hidden'}`}>
        {showContents && isApproveTransaction && <>
          <div className={`coin-circle-holder d-flex align-items-center justify-content-center`}>
            <div className={`coin-circle ${showInnerContents ? '' : 'hidden' }`}>
              <div className="coin-circle-inner">
                <div className="completion-indicator">
                  {!transaction.mined && <img className="waiting-icon rotating" src="/images/spinner-green-small.png"/>}
                  {transaction.mined && <img className="waiting-icon" src="/images/green-checkmark.svg"/>}
                </div>
                <img className="coin coin-1" src={`/images/currency/${coin}-icon-small.svg`} />
                <img className="coin coin-2" src={`/images/currency/${coin}-icon-small.svg`} />
                <img className="coin coin-3" src={`/images/currency/${coin}-icon-small.svg`} />
              </div>
            </div>
          </div>
          <div className={`title-holder ${showInnerContents ? '' : 'hidden' }`}>
            {!transaction.mined && <div className="title">{fbt('Granting permission to move your ' + fbt.param('coin', coin.toUpperCase()), 'Granting permission to move your coin')}</div>}
          {transaction.mined && <div className="title">{fbt('Permission granted to move your ' + fbt.param('coin', coin.toUpperCase()), 'Permission granted to move your coin')}</div>}
          </div>
        </>}
        {/* TODO do not forget about show contents flag*/}
        {showContents && true}
      </div>
    </div>
    <style jsx>{`
      .side-panel-message {
        width: 100%;
        border-radius: 5px;
        border: solid 1px #cdd7e0;
        background-color: #ffffff;
        padding: 15px 20px;
        margin-bottom: 10px;
      }

      .contents-body {
        opacity: 1;
        max-height: 300px;
      }

      .animate .contents-body.hidden {
        opacity: 0;
        max-height: 0px;
      }

      .animate .contents-body {
        transition: max-height 0.7s ease-out, opacity 0.4s linear 0.3s;
      }

      .coin-circle-holder {
        width: 67px;
        height: 67px;
        margin-bottom: 14px;
      }

      .coin-circle {
        max-height: 67px;
        max-width: 67px;
        width: 80px;
        height: 80px;
        border-radius: 34px;
        border: solid 1px #b5bfc8;
        background-color: white;
        position: relative;
        transition: max-height 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5), max-width 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5);
      }

      .coin-circle.hidden {
        max-width: 0px;
        max-height: 0px;
      }

      .coin-circle.hidden .coin-circle-inner {
        opacity: 0;
      }

      .coin-circle .coin-circle-inner {
        opacity: 1;
        transition: opacity 0.3s ease-out 0.4s;
      }

      .title-holder.hidden {
        opacity: 0;
      }

      .title-holder {
        opacity: 1;
        transition: opacity 0.3s ease-out 0.7s;
      }

      .title {
        font-size: 14px;
        font-weight: bold;
        text-align: center;
        color: #1e313f;
        max-width: 170px;
      }

      .completion-indicator {
        position: absolute;
        right: -6px;
        bottom: 0px;
        z-index: 2;
      }

      .coin {
        width: 20px;
        height: 20px;
        position: absolute;
      }

      .coin-1 {
        left: 22.5px;
        top: 10.5px;
      }

      .coin-2 {
        left: 33.5px;
        top: 30px;
      }

      .coin-3 {
        left: 12px;
        top: 30px;
      }

      .waiting-icon {
        width: 25px;
        height: 25px;
      }

      .rotating {
        -webkit-animation:spin 2s linear infinite;
        -moz-animation:spin 2s linear infinite;
        animation:spin 2s linear infinite;
      }

      @-moz-keyframes spin { 100% { -moz-transform: rotate(360deg); } }
      @-webkit-keyframes spin { 100% { -webkit-transform: rotate(360deg); } }
      @keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } }
    `}</style>
  </>
}

export default SidePanelTransactionMessage
