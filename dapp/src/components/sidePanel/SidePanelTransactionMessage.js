import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { getEtherscanHost } from 'utils/web3'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'

import CoinCircleGraphics from 'components/sidePanel/CoinCircleGraphics'
import TransactionStore from 'stores/TransactionStore'
import { formatCurrency, formatCurrencyConditional } from 'utils/math'
import { assetRootPath } from 'utils/image'

const SidePanelTransactionMessage = ({
  transaction,
  dismissTransaction,
  animate = false,
}) => {
  const isApproveTransaction = transaction.type === 'approve'
  const isMintTransaction = transaction.type === 'mint'
  const isRedeemTransaction = transaction.type === 'redeem'
  const isRebaseTransaction = transaction.type === 'rebase'
  const isRebaseOptInTransaction = transaction.type === 'rebaseOptIn'
  const isApproveWrapTransaction = transaction.type === 'approveWrap'
  const isWrapTransaction = transaction.type === 'wrap'
  const isUnwrapTransaction = transaction.type === 'unwrap'
  const [showContents, setShowContents] = useState(!animate)
  const [showInnerContents, setShowInnerContents] = useState(false)
  const [showExpandedContents, setShowExpandedContents] = useState(false)
  const coin = transaction.coins
  const isExpanded = useStoreState(
    TransactionStore,
    (s) =>
      s.expandedTransaction && s.expandedTransaction.hash === transaction.hash
  )
  const web3react = useWeb3React()

  const etherscanLinkHash = transaction.safeData
    ? transaction.safeData.txHash
    : transaction.hash
  const etherscanLink = `${getEtherscanHost(web3react)}/tx/${etherscanLinkHash}`
  /* failed transactions that have not been mined and shouldn't have a hash
   * still have a hash for deduplication purposes. This figures out if the hash
   * is a valid one, and if we should link to etherscan
   */
  const isValidHash = transaction.hash && transaction.hash.startsWith('0x')

  useEffect(() => {
    if (!isExpanded) {
      setShowExpandedContents(false)
    } else {
      // delay so that we can animate height
      setTimeout(() => {
        setShowExpandedContents(true)
      }, 10)
    }
  }, [isExpanded])

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

  const coinDataPresent =
    transaction.data &&
    transaction.data.ousd !== undefined &&
    transaction.data.dai !== undefined &&
    transaction.data.usdt !== undefined &&
    transaction.data.usdc !== undefined
  const redeemDataAvailable = isRedeemTransaction && coinDataPresent
  const mintDataAvailable = isMintTransaction && coinDataPresent

  return (
    <>
      <div
        className={`side-panel-message ${animate ? 'animate' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          //window.open(etherscanLink, '_blank')
        }}
      >
        <div className="main-contents">
          {showContents && isValidHash && (
            <a
              className={`etherscan-link ${showInnerContents ? '' : 'hidden'}`}
              onClick={(e) => {
                window.open(etherscanLink, '_blank')
              }}
            >
              &nbsp;
            </a>
          )}
          {showContents && (mintDataAvailable || redeemDataAvailable) && (
            <a
              className={`expand-link ${showInnerContents ? '' : 'hidden'} ${
                isExpanded ? 'expanded' : ''
              } `}
              onClick={(e) => {
                TransactionStore.update((s) => {
                  s.expandedTransaction = isExpanded ? null : transaction
                })
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              &nbsp;
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
            {showContents && isRebaseTransaction && (
              <>
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={coin}
                  animate={animate}
                  showTxStatusIcon={true}
                  drawType="all-same"
                />
                <div
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt('Increasing OUSD supply', 'Increasing OUSD supply')}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt('OUSD supply increased', 'OUSD supply increased')}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed to increase OUSD supply',
                        'Failed to increase OUSD supply'
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {showContents && isRebaseOptInTransaction && (
              <>
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={coin}
                  animate={animate}
                  showTxStatusIcon={true}
                  drawType="all-same"
                />
                <div
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt(
                        'Opting in to OUSD rebasing',
                        'Opting in to OUSD rebasing'
                      )}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Opted in to OUSD rebase',
                        'Opted in to OUSD rebase'
                      )}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed to opt in to OUSD rebase',
                        'Failed to opt in to OUSD rebase'
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

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
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
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
                          src={assetRootPath('/images/spinner-green-small.png')}
                        />
                      )}
                      {transaction.mined && !transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/green-checkmark.svg')}
                        />
                      )}
                      {transaction.mined && transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/red-x-filled.svg')}
                        />
                      )}
                    </div>
                  </div>
                  <CoinCircleGraphics
                    transaction={transaction}
                    coin={
                      coin === 'mix' ? ['dai', 'usdt', 'usdc'] : coin.split(',')
                    }
                    animate={animate}
                    showTxStatusIcon={false}
                    drawType="per-coin"
                  />
                </div>
                <div
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt(
                        'Swapping OUSD for ' +
                          fbt.param(
                            'coin',
                            coin.split(',').join(' & ').toUpperCase()
                          ),
                        'Swapping OUSD for coins'
                      )}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Swapped OUSD for ' +
                          fbt.param(
                            'coin',
                            coin.split(',').join(' & ').toUpperCase()
                          ),
                        'Swapped OUSD for coins'
                      )}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed swapping OUSD for ' +
                          fbt.param(
                            'coin',
                            coin.split(',').join(' & ').toUpperCase()
                          ),
                        'Failed swapping OUSD for coins'
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
                          src={assetRootPath('/images/spinner-green-small.png')}
                        />
                      )}
                      {transaction.mined && !transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/green-checkmark.svg')}
                        />
                      )}
                      {transaction.mined && transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/red-x-filled.svg')}
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
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt(
                        'Swapping ' +
                          fbt.param(
                            'coin',
                            coin.split(',').join(' & ').toUpperCase()
                          ) +
                          ' for OUSD',
                        'Swapping coins for OUSD'
                      )}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt(
                        fbt.param(
                          'coin',
                          coin.split(',').join(' & ').toUpperCase()
                        ) + ' swapped for OUSD',
                        'Swapped coins for OUSD'
                      )}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed swapping ' +
                          fbt.param(
                            'coin',
                            coin.split(',').join(' & ').toUpperCase()
                          ) +
                          ' for OUSD',
                        'Failed swapping for OUSD'
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {showContents && isApproveWrapTransaction && (
              <>
                <CoinCircleGraphics
                  transaction={transaction}
                  coin={coin}
                  animate={animate}
                  showTxStatusIcon={true}
                  drawType="all-same"
                />
                <div
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
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
            {showContents && isUnwrapTransaction && (
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
                          src={assetRootPath('/images/spinner-green-small.png')}
                        />
                      )}
                      {transaction.mined && !transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/green-checkmark.svg')}
                        />
                      )}
                      {transaction.mined && transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/red-x-filled.svg')}
                        />
                      )}
                    </div>
                  </div>
                  <CoinCircleGraphics
                    transaction={transaction}
                    coin={
                      coin === 'mix' ? ['dai', 'usdt', 'usdc'] : coin.split(',')
                    }
                    animate={animate}
                    showTxStatusIcon={false}
                    drawType="per-coin"
                  />
                </div>
                <div
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt('Wrapping OUSD into wOUSD', 'Wrapping OUSD')}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt('Wrapped OUSD into wOUSD', 'Wrapped OUSD')}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed wrapping OUSD into wOUSD',
                        'Failed wrapping OUSD'
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {showContents && isWrapTransaction && (
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
                          src={assetRootPath('/images/spinner-green-small.png')}
                        />
                      )}
                      {transaction.mined && !transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/green-checkmark.svg')}
                        />
                      )}
                      {transaction.mined && transaction.isError && (
                        <img
                          className="waiting-icon"
                          src={assetRootPath('/images/red-x-filled.svg')}
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
                  className={`title-holder ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                >
                  {!transaction.mined && (
                    <div className="title">
                      {fbt('Unwrapping wOUSD into OUSD', 'Unwrapping wOUSD')}
                    </div>
                  )}
                  {transaction.mined && !transaction.isError && (
                    <div className="title">
                      {fbt('wOUSD unwrapped into OUSD', 'Unwrapped wOUSD')}
                    </div>
                  )}
                  {transaction.mined && transaction.isError && (
                    <div className="title">
                      {fbt(
                        'Failed unwrapping wOUSD into OUSD',
                        'Failed unwrapping wOUSD'
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
        {isExpanded && (
          <div
            className={`expanded-area d-flex align-items-stretch ${
              showExpandedContents ? 'expanded' : ''
            }`}
          >
            {showExpandedContents && (
              <>
                <div className="expand-box left d-flex flex-column align-items-center justify-content-center">
                  {redeemDataAvailable && (
                    <>
                      <div>
                        {formatCurrencyConditional(
                          transaction.data.ousd,
                          100,
                          2,
                          0
                        )}{' '}
                        OUSD
                      </div>
                    </>
                  )}
                  {mintDataAvailable && (
                    <>
                      {parseFloat(transaction.data.usdt) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.usdt,
                            100,
                            2,
                            0
                          )}{' '}
                          USDT
                        </div>
                      )}
                      {parseFloat(transaction.data.dai) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.dai,
                            100,
                            2,
                            0
                          )}{' '}
                          DAI
                        </div>
                      )}
                      {parseFloat(transaction.data.usdc) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.usdc,
                            100,
                            2,
                            0
                          )}{' '}
                          USDC
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="small-arrow d-flex align-items-center justify-content-center align-self-center">
                  <img src={assetRootPath('/images/small-arrow.svg')} />
                </div>
                <div className="expand-box right d-flex flex-column align-items-center justify-content-center">
                  {redeemDataAvailable && (
                    <>
                      {parseFloat(transaction.data.usdt) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.usdt,
                            100,
                            2,
                            0
                          )}{' '}
                          USDT
                        </div>
                      )}
                      {parseFloat(transaction.data.dai) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.dai,
                            100,
                            2,
                            0
                          )}{' '}
                          DAI
                        </div>
                      )}
                      {parseFloat(transaction.data.usdc) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.usdc,
                            100,
                            2,
                            0
                          )}{' '}
                          USDC
                        </div>
                      )}
                    </>
                  )}
                  {mintDataAvailable && (
                    <>
                      <div>
                        {formatCurrencyConditional(
                          transaction.data.ousd,
                          100,
                          2,
                          0
                        )}{' '}
                        OUSD
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <style jsx>{`
        .side-panel-message {
          width: 100%;
          border-radius: 5px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          margin-bottom: 10px;
        }

        .main-contents {
          padding: 15px 20px;
          position: relative;
        }

        .small-arrow {
          position: relative;
          background-color: white;
          width: 16px;
          height: 16px;
          border-radius: 8px;
          margin-left: -8px;
          margin-right: -8px;
          z-index: 2;
        }

        .expanded-area {
          width: 100%;
          height: 0px;
          transition: height 0.3s ease-out;
        }

        .expanded-area.expanded {
          height: 72px;
        }

        .expand-box {
          min-height: 50px;
          background-color: #f2f3f5;
          padding: 8px 10px;
          flex-grow: 1;
          font-size: 12px;
          font-weight: normal;
          text-align: center;
          color: #1e313f;
        }

        .expand-box.left {
          border-radius: 0px 0px 0px 5px;
          margin: 0px 1.5px 3px 3px;
        }

        .expand-box.right {
          border-radius: 0px 0px 5px 0px;
          margin: 0px 3px 3px 1.5px;
        }

        .expand-link.hidden {
          opacity: 0;
        }

        .expand-link {
          position: absolute;
          right: 34px;
          bottom: 10px;
          cursor: pointer;
          opacity: 1;
          transition: opacity 0.7s ease-out 0.5s;
          width: 17px;
          height: 17px;
          background-image: url('/images/more-icon-off.svg');
          background-size: 17px 17px;
        }

        .expand-link.expanded {
          background-image: url('/images/more-icon-on.svg') !important;
        }

        .expand-link:hover {
          background-image: url('/images/more-icon-hover.svg');
        }

        .etherscan-link {
          position: absolute;
          right: 10px;
          bottom: 10px;
          opacity: 0.6;
          cursor: pointer;
          width: 17px;
          height: 17px;
          background-image: url('/images/etherscan-icon.svg');
          background-size: 17px 17px;
        }

        .etherscan-link:hover {
          opacity: 1;
        }

        .etherscan-link img,
        .expand-link img {
          width: 17px;
          height: 17px;
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
          cursor: pointer;
        }

        .side-panel-message:hover .dismiss-link {
          display: block;
        }

        .dismiss-link.hidden {
          opacity: 0;
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
          font-weight: normal;
          text-align: center;
          color: #183140;
          max-width: 150px;
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
