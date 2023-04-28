import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { assetRootPath } from 'utils/image'

const CoinCircleGraphics = ({
  transaction,
  coin,
  animate,
  showTxStatusIcon = false,
  drawType = 'all-same',
}) => {
  const [showInnerContents, setShowInnerContents] = useState(false)

  useEffect(() => {
    if (animate) {
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
        className={`coin-circle-holder d-flex align-items-center justify-content-center`}
      >
        <div className={`coin-circle ${showInnerContents ? '' : 'hidden'}`}>
          <div className="coin-circle-inner">
            {showTxStatusIcon && (
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
            )}
            {(drawType === 'all-same' ||
              (Array.isArray(coin) && coin.length === 3)) && (
              <>
                <img
                  className={`coin coin-3-1 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[0] : coin
                    }-icon-small.svg`
                  )}
                />
                <img
                  className={`coin coin-3-2 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[1] : coin
                    }-icon-small.svg`
                  )}
                />
                <img
                  className={`coin coin-3-3 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[2] : coin
                    }-icon-small.svg`
                  )}
                />
              </>
            )}
            {drawType === 'per-coin' && coin.length === 2 && (
              <>
                <img
                  className={`coin medium coin-2-1 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[0] : coin
                    }-icon-small.svg`
                  )}
                />
                <img
                  className={`coin medium coin-2-2 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[1] : coin
                    }-icon-small.svg`
                  )}
                />
              </>
            )}
            {drawType === 'per-coin' && coin.length === 1 && (
              <>
                <img
                  className={`coin big coin-1 ${
                    showInnerContents ? '' : 'hidden'
                  }`}
                  src={assetRootPath(
                    `/images/currency/${
                      Array.isArray(coin) ? coin[0] : coin
                    }-icon-small.svg`
                  )}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
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
          transition: max-height 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5),
            max-width 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5);
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

        .completion-indicator {
          position: absolute;
          right: -6px;
          bottom: 0px;
          z-index: 1;
        }

        .coin {
          width: 20px;
          height: 20px;
          position: absolute;
          transition: left 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5) 0.5s,
            top 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5) 0.5s;
        }

        .coin.medium {
          width: 24px;
          height: 24px;
        }

        .coin.big {
          width: 28px;
          height: 28px;
        }

        .coin.hidden {
          left: 22.5px;
          top: 22.5px;
        }

        .coin-3-1 {
          left: 22.5px;
          top: 10.5px;
        }

        .coin-3-2 {
          left: 33.5px;
          top: 30px;
        }

        .coin-3-3 {
          left: 12px;
          top: 30px;
        }

        .coin-2-1 {
          left: 30px;
          top: 20px;
        }

        .coin-2-2 {
          left: 12px;
          top: 20px;
        }

        .coin-1 {
          left: 18px;
          top: 18px;
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
      `}</style>
    </>
  )
}

export default CoinCircleGraphics
