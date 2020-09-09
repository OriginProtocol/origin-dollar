import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { getEtherscanHost } from 'utils/web3'
import { useWeb3React } from '@web3-react/core'

import CoinCircleGraphics from 'components/sidePanel/CoinCircleGraphics'
import { TransactionStore } from 'stores/TransactionStore'

const SidePanelTransactionMessage = ({
  transaction,
  dismissTransaction,
  animate = false,
}) => {
  const isApproveTransaction = transaction.type === 'approve'
  const isMintTransaction = transaction.type === 'mint'
  const isRedeemTransaction = transaction.type === 'redeem'
  const [showContents, setShowContents] = useState(!animate)
  const [showInnerContents, setShowInnerContents] = useState(false)
  const coin = transaction.coins
  const web3react = useWeb3React()
  const etherscanLink = `${getEtherscanHost(web3react)}/tx/${transaction.hash}`

  useEffect(() => {
    if (animate) {
      setTimeout(() => {
        setShowContents(true)
      }, 100)

      setTimeout(() => {
        setShowInnerContents(true)
      }, 100 + 300)
    } else {
      setTimeout(() => {
        setShowInnerContents(true)
      }, 100)
    }
  }, [])

  return (
    <>
      <div
        className={`side-panel-message ${animate ? 'animate' : ''}`}
        onClick={(e) => {
          window.open(etherscanLink, '_blank')
        }}
      >
        {showContents && (
          <a
            className={`etherscan-link ${showInnerContents ? '' : 'hidden'}`}
            href={etherscanLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/images/etherscan-icon.svg" />
          </a>
        )}
        {showContents && (
          <a
            className={`dismiss-link ${showInnerContents ? '' : 'hidden'}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()

              TransactionStore.update((s) => {
                s.transactionHashesToDismiss = [transaction.hash]
              })
            }}
          >
            ×
          </a>
        )}
        <div
          className={`contents-body d-flex flex-column align-items-center ${
            showContents ? '' : 'hidden'
          }`}
        >
          {showContents && isApproveTransaction && (
            <>
              <CoinCircleGraphics
                transaction={transaction}
                coin={coin}
                animate={animate}
                showTxStatusIcon={true}
                drawType="all-same"
              />
              <div
                className={`title-holder ${showInnerContents ? '' : 'hidden'}`}
              >
                {!transaction.mined && (
                  <div className="title">
                    {fbt(
                      'Granting permission to move your ' +
                        fbt.param('coin', coin.toUpperCase()),
                      'Granting permission to move your coin'
                    )}
                  </div>
                )}
                {transaction.mined && !transaction.isError && (
                  <div className="title">
                    {fbt(
                      'Permission granted to move your ' +
                        fbt.param('coin', coin.toUpperCase()),
                      'Permission granted to move your coin'
                    )}
                  </div>
                )}
                {transaction.mined && transaction.isError && (
                  <div className="title">
                    {fbt(
                      'Failed granting permission to move your ' +
                        fbt.param('coin', coin.toUpperCase()),
                      'Failed granting permission to move your coin'
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {showContents && isRedeemTransaction && (
            <>
              <div className="d-flex align-items-center">
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={'ousd'}
                  animate={animate}
                  showTxStatusIcon={false}
                  drawType="all-same"
                />
                <div className={`line ${showInnerContents ? '' : 'hidden'}`}>
                  <div className="completion-indicator">
                    {!transaction.mined && (
                      <img
                        className="waiting-icon rotating"
                        src="/images/spinner-green-small.png"
                      />
                    )}
                    {transaction.mined && !transaction.isError && (
                      <img
                        className="waiting-icon"
                        src="/images/green-checkmark.svg"
                      />
                    )}
                    {transaction.mined && transaction.isError && (
                      <img
                        className="waiting-icon"
                        src="/images/red-x-filled.svg"
                      />
                    )}
                  </div>
                </div>
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={coin.split(',')}
                  animate={animate}
                  showTxStatusIcon={false}
                  drawType="per-coin"
                />
              </div>
              <div
                className={`title-holder ${showInnerContents ? '' : 'hidden'}`}
              >
                {!transaction.mined && (
                  <div className="title">
                    {fbt(
                      'Converting OUSD to ' +
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) +
                        '.',
                      'Converting OUSD to coins'
                    )}
                  </div>
                )}
                {transaction.mined && !transaction.isError && (
                  <div className="title">
                    {fbt(
                      'Converting OUSD to ' +
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) +
                        '.',
                      'Converted OUSD to coins'
                    )}
                  </div>
                )}
                {transaction.mined && transaction.isError && (
                  <div className="title">
                    {fbt(
                      'Failed converting OUSD to ' +
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) +
                        '.',
                      'Failed converting OUSD to coins'
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {showContents && isMintTransaction && (
            <>
              <div className="d-flex align-items-center">
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={coin.split(',')}
                  animate={animate}
                  showTxStatusIcon={false}
                  drawType="per-coin"
                />
                <div className={`line ${showInnerContents ? '' : 'hidden'}`}>
                  <div className="completion-indicator">
                    {!transaction.mined && (
                      <img
                        className="waiting-icon rotating"
                        src="/images/spinner-green-small.png"
                      />
                    )}
                    {transaction.mined && !transaction.isError && (
                      <img
                        className="waiting-icon"
                        src="/images/green-checkmark.svg"
                      />
                    )}
                    {transaction.mined && transaction.isError && (
                      <img
                        className="waiting-icon"
                        src="/images/red-x-filled.svg"
                      />
                    )}
                  </div>
                </div>
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={'ousd'}
                  animate={animate}
                  showTxStatusIcon={false}
                  drawType="all-same"
                />
              </div>
              <div
                className={`title-holder ${showInnerContents ? '' : 'hidden'}`}
              >
                {!transaction.mined && (
                  <div className="title">
                    {fbt(
                      'Converting ' +
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) +
                        ' to OUSD',
                      'Converting coins to OUSD'
                    )}
                  </div>
                )}
                {transaction.mined && !transaction.isError && (
                  <div className="title">
                    {fbt(
                      fbt.param(
                        'coin',
                        coin.split(',').join(' & ').toUpperCase()
                      ) + ' converted to OUSD',
                      'Converted coins to OUSD'
                    )}
                  </div>
                )}
                {transaction.mined && transaction.isError && (
                  <div className="title">
                    {fbt(
                      'Failed converting ' +
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) +
                        ' to OUSD',
                      'Failed with converting OUSD'
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          {/* do not forget about show contents flag when adding new stuff*/}
          {showContents && false}
        </div>
      </div>
      <style jsx>{`
        .side-panel-message {
          position: relative;
          width: 100%;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          padding: 15px 20px;
          margin-bottom: 10px;
          cursor: pointer;
        }

        .side-panel-message:hover {
          background-color: #f5f6f7;
        }

        .etherscan-link {
          position: absolute;
          right: 10px;
          bottom: 10px;
          opacity: 1;
          transition: opacity 0.7s ease-out 0.5s;
        }

        .etherscan-link.hidden {
          opacity: 0;
        }

        .dismiss-link {
          display: none;
          position: absolute;
          right: 0px;
          top: -10px;
          opacity: 1;
          font-size: 20px;
          color: #8293a4;
          transition: opacity 0.7s ease-out 0.5s;
          padding: 10px;
        }

        .side-panel-message:hover .dismiss-link {
          display: block;
        }

        .dismiss-link.hidden {
          opacity: 0;
        }

        .etherscan-link img {
          width: 15px;
          height: 15px;
        }

        .contents-body {
          opacity: 1;
          max-height: 300px;
          margin-top: 12px;
        }

        .animate .contents-body.hidden {
          opacity: 0;
          max-height: 0px;
        }

        .animate .contents-body {
          transition: max-height 0.7s ease-out, opacity 0.4s linear 0.3s;
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
          color: #183140;
          max-width: 170px;
          line-height: 1.2;
        }

        .line {
          width: 65px;
          height: 1px;
          background-color: #b5bfc8;
          margin-bottom: 14px;
          opacity: 1;
          transition: opacity 0.3s ease-out 0.4s;
          position: relative;
        }

        .line.hidden {
          opacity: 0;
        }

        .waiting-icon {
          width: 25px;
          height: 25px;
        }

        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }

        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }

        .completion-indicator {
          position: absolute;
          top: -13.5px;
          left: 20px;
        }
      `}</style>
    </>
  )
}

export default SidePanelTransactionMessage
