import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { getEtherscanHost } from 'utils/web3'
import { useStoreState } from 'pullstate'
import TransactionStore from 'stores/TransactionStore'
import { formatCurrencyConditional } from 'utils/math'
import { assetRootPath } from 'utils/image'

const CoinImage = ({ coin }) => {
  const coinsToRender =
    coin === 'mix' ? ['weth', 'retFh', 'steth', 'frxeth'] : coin.split(',')
  const size = 24
  return (
    <>
      <div className="coin-image">
        {coinsToRender?.map((current, index) => (
          <img
            key={`${current}_${index}`}
            style={{
              left: index * -1 * (size / 2),
              zIndex: coinsToRender.length - index,
            }}
            src={assetRootPath(`/images/currency/${current}-icon-small.svg`)}
            alt={current}
          />
        ))}
      </div>
      <style jsx>
        {`
          .coin-image {
            display: flex;
            align-items: center;
            justify-center: center;
            position: relative;
            width: ${coinsToRender.length > 1
              ? size + (coinsToRender.length - 1) * (size / 2) * 1.25
              : size * 1.25}px;
            padding: 4px;
          }

          .coin-image img {
            position: relative;
            width: ${size}px;
            height: ${size}px;
            transition: left 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5) 0.5s,
              top 0.4s cubic-bezier(0.5, -0.5, 0.5, 1.5) 0.5s;
          }
        `}
      </style>
    </>
  )
}

const TransactionImage = ({ from, to }) => (
  <div className="d-inline-flex align-items-center">
    <CoinImage coin={from} />
    {to && (
      <>
        <img
          className="mx-2"
          src={assetRootPath('/images/arrowRight.png')}
          alt="arrow"
        />
        <CoinImage coin={to} />
      </>
    )}
  </div>
)

const ActivityItem = ({ transaction, states = {}, visual }) => {
  const etherscanLinkHash = transaction.safeData
    ? transaction.safeData.txHash
    : transaction.hash

  const etherscanLink = `${getEtherscanHost()}/tx/${etherscanLinkHash}`
  /* failed transactions that have not been mined and shouldn't have a hash
   * still have a hash for deduplication purposes. This figures out if the hash
   * is a valid one, and if we should link to etherscan
   */
  const isValidHash = transaction.hash && transaction.hash.startsWith('0x')

  const currentState = !transaction.mined
    ? 'pending'
    : transaction.mined && !transaction.isError
    ? 'success'
    : 'failed'

  return (
    <>
      <div className="activity-item">
        <div className="activity-details">
          <div className="status-container">
            <span className="status-icon">
              {currentState === 'pending' && (
                <img
                  className="rotating"
                  src={assetRootPath('/images/spinner-green.png')}
                  alt="Pending"
                />
              )}
              {currentState === 'success' && (
                <img
                  src={assetRootPath('/images/green-checkmark.png')}
                  alt="Success"
                />
              )}
              {currentState === 'failed' && (
                <img
                  src={assetRootPath('/images/red-x-filled.png')}
                  alt="Failed"
                />
              )}
            </span>
            <div className="status-details ml-1">
              <span className="ml-1 mr-2 description">
                {states[currentState]?.action}
              </span>
              {isValidHash && (
                <a
                  className="etherscan-link"
                  href={etherscanLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={assetRootPath('/images/external-link-white.svg')}
                    alt="Navigate to Etherscan"
                  />
                </a>
              )}
            </div>
          </div>
          <span className="info">{states[currentState]?.description}</span>
        </div>
        {visual && <div className="activity-images">{visual}</div>}
      </div>
      <style jsx>{`
        .activity-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          width: 100%;
          background: #1e1f25;
          color: #fafbfb;
          height: 78px;
        }

        .activity-details {
          display: flex;
          flex-direction: column;
        }

        .activity-details .status-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          margin-bottom: 8px;
        }

        .status-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          height: 13px;
          width: 13px;
        }

        .status-icon img {
          height: 100%;
          width: 100%;
        }

        .status-details {
          display: flex;
          flex-direction: row;
          align-items: center;
          font-size: 14px;
          width: 100%;
        }

        .status-details .description {
          font-size: 14px;
          color: #fafbfb;
        }

        .activity-details .info {
          font-size: 12px;
          color: #828699;
          margin-left: 4px;
          font-family: Sailec;
        }

        .activity-images {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-shrink: 0;
          padding: 8px;
          background: #18191c;
          border-radius: 4px;
          height: 40px;
        }

        .etherscan-link img {
          width: 8px;
          height: 8px;
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

const RebaseTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Rebasing', 'Rebasing'),
        description: fbt('Increasing OETH supply', 'Increasing OETH supply'),
      },
      success: {
        action: fbt('Rebased', 'Rebased'),
        description: fbt('OETH supply increased', 'OETH supply increased'),
      },
      failed: {
        action: fbt('Failed to rebase', 'Failed to rebase'),
        description: fbt(
          'Failed to increase OETH supply',
          'Failed to increase OETH supply'
        ),
      },
    }}
    visual={<TransactionImage transaction={transaction} from={coin} />}
  />
)

const RebaseOptInTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Rebase opt-in pending', 'Rebase opt-in pending'),
        description: fbt('To receive yield', 'To receive yield'),
      },
      success: {
        action: fbt('Rebase opt-in succeeded', 'Rebase opt-in succeeded'),
        description: fbt(
          'You will now receive yield',
          'You will now receive yield'
        ),
      },
      failed: {
        action: fbt('Rebase opt-in failed', 'Rebase opt-in failed'),
        description: fbt('To receive yield', 'To receive yield'),
      },
    }}
    visual={<TransactionImage transaction={transaction} from={coin} />}
  />
)

const ApproveTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Pending approval', 'Pending approval'),
        description: fbt(
          `Approve ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Pending approval'
        ),
      },
      success: {
        action: fbt('Approved', 'Approved'),
        description: fbt(
          `Approved ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Approved'
        ),
      },
      failed: {
        action: fbt('Approval failed', 'Approval failed'),
        description: fbt(
          `Approve ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Approval failed'
        ),
      },
    }}
    visual={<TransactionImage transaction={transaction} from={coin} />}
  />
)

const RedeemTransaction = ({ transaction, coin }) => {
  const context = transaction?.data || {}
  const baseDescription = fbt(
    `${fbt.param('oeth context', context?.oeth || '-')} OETH for ${fbt.param(
      'lsds context',
      context?.mix || '-'
    )} LSDs`,
    'Swap coins for Redeem'
  )
  return (
    <ActivityItem
      transaction={transaction}
      coin={coin}
      states={{
        pending: {
          action: fbt('Pending redeem', 'Pending redeem'),
          description: baseDescription,
        },
        success: {
          action: fbt('Redeemed', 'Redeemed'),
          description: baseDescription,
        },
        failed: {
          action: fbt('Redeem failed', 'Redeem failed'),
          description: baseDescription,
        },
      }}
      visual={
        <TransactionImage transaction={transaction} from="oeth" to={coin} />
      }
    />
  )
}

const MintTransaction = ({ transaction, coin }) => {
  const context = transaction?.data || {}
  const baseDescription = fbt(
    `${fbt.param('mint context', context?.[coin] || '-')} ${fbt.param(
      'coin',
      coin.toUpperCase()
    )} for ${fbt.param('oeth context', context?.oeth || '-')} OETH`,
    'Swap coins for OETH'
  )
  return (
    <ActivityItem
      transaction={transaction}
      coin={coin}
      states={{
        pending: {
          action: fbt('Pending swap', 'Pending swap'),
          description: baseDescription,
        },
        success: {
          action: fbt('Swapped', 'Swapped'),
          description: baseDescription,
        },
        failed: {
          action: fbt('Swap failed', 'Swap failed'),
          description: baseDescription,
        },
      }}
      visual={
        <TransactionImage transaction={transaction} from={coin} to="oeth" />
      }
    />
  )
}

const ApproveWrapTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Pending approval', 'Pending approval'),
        description: fbt(
          `Approve ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Pending approval'
        ),
      },
      success: {
        action: fbt('Approved', 'Approved'),
        description: fbt(
          `Approved ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Approved'
        ),
      },
      failed: {
        action: fbt('Approval failed', 'Approval failed'),
        description: fbt(
          `Approve ${fbt.param(
            'coin',
            coin?.split(',').join(' & ').toUpperCase()
          )} for swapping`,
          'Approval failed'
        ),
      },
    }}
    visual={<TransactionImage transaction={transaction} from={coin} />}
  />
)

const ApproveUnWrapTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Wrapping', 'Wrapping'),
        description: fbt('Wrapping OETH into wOETH', 'Wrapping OETH'),
      },
      success: {
        action: fbt('Wrapped', 'Wrapped'),
        description: fbt('Wrapped OETH into wOETH', 'Wrapped OETH'),
      },
      failed: {
        action: fbt('Failed wrapping', 'Failed wrapping'),
        description: fbt(
          'Failed wrapping OETH into wOETH',
          'Failed wrapping OETH'
        ),
      },
    }}
    visual={
      <TransactionImage transaction={transaction} from="oeth" to={coin} />
    }
  />
)

const WrapTransaction = ({ transaction, coin }) => (
  <ActivityItem
    transaction={transaction}
    coin={coin}
    states={{
      pending: {
        action: fbt('Unwrapping', 'Unwrapping'),
        description: fbt('Unwrapping wOETH into OETH', 'Unwrapping wOETH'),
      },
      success: {
        action: fbt('Unwrapped', 'Unwrapped'),
        description: fbt('wOETH unwrapped into OETH', 'Unwrapped wOETH'),
      },
      failed: {
        action: fbt('Failed unwrapping', 'Failed unwrapping'),
        description: fbt(
          'Failed unwrapping wOETH into OETH',
          'Failed unwrapping wOETH'
        ),
      },
    }}
    visual={
      <TransactionImage transaction={transaction} from="oeth" to={coin} />
    }
  />
)

const SidePanelTransactionMessage = ({ transaction, animate = false }) => {
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
    transaction.data.oeth !== undefined &&
    transaction.data.reth !== undefined &&
    transaction.data.frxeth !== undefined &&
    transaction.data.steth !== undefined &&
    transaction.data.weth !== undefined

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
              <RebaseTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isRebaseOptInTransaction && (
              <RebaseOptInTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isApproveTransaction && (
              <ApproveTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isRedeemTransaction && (
              <RedeemTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isMintTransaction && (
              <MintTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isApproveWrapTransaction && (
              <ApproveWrapTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isUnwrapTransaction && (
              <ApproveUnWrapTransaction transaction={transaction} coin={coin} />
            )}
            {showContents && isWrapTransaction && (
              <WrapTransaction transaction={transaction} coin={coin} />
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
                          transaction.data.oeth,
                          100,
                          6,
                          0
                        )}{' '}
                        OETH
                      </div>
                    </>
                  )}
                  {mintDataAvailable && (
                    <>
                      {parseFloat(transaction.data.weth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.weth,
                            100,
                            6,
                            0
                          )}{' '}
                          WETH
                        </div>
                      )}
                      {parseFloat(transaction.data.reth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.reth,
                            100,
                            6,
                            0
                          )}{' '}
                          rETH
                        </div>
                      )}
                      {parseFloat(transaction.data.steth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.steth,
                            100,
                            6,
                            0
                          )}{' '}
                          stETH
                        </div>
                      )}
                      {parseFloat(transaction.data.frxeth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.frxeth,
                            100,
                            6,
                            0
                          )}{' '}
                          frxETH
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
                      {parseFloat(transaction.data.weth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.weth,
                            100,
                            6,
                            0
                          )}{' '}
                          WETH
                        </div>
                      )}
                      {parseFloat(transaction.data.reth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.reth,
                            100,
                            6,
                            0
                          )}{' '}
                          rETH
                        </div>
                      )}
                      {parseFloat(transaction.data.steth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.steth,
                            100,
                            6,
                            0
                          )}{' '}
                          stETH
                        </div>
                      )}
                      {parseFloat(transaction.data.frxeth) > 0 && (
                        <div>
                          {formatCurrencyConditional(
                            transaction.data.frxeth,
                            100,
                            6,
                            0
                          )}{' '}
                          frxETH
                        </div>
                      )}
                    </>
                  )}
                  {mintDataAvailable && (
                    <>
                      <div>
                        {formatCurrencyConditional(
                          transaction.data.oeth,
                          100,
                          6,
                          0
                        )}{' '}
                        OETH
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
          border-bottom: solid 1px #141519;
          background-color: #1e1f25;
        }

        .main-contents {
          position: relative;
        }

        .small-arrow {
          position: relative;
          background-color: #fafbfb;
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
          color: #828699;
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
          color: #fafbfb;
          max-width: 150px;
          line-height: 1.2;
        }

        .line {
          width: 65px;
          height: 1px;
          background-color: #1e1f25;
          margin-bottom: 14px;
          opacity: 1;
          transition: opacity 0.3s ease-out 0.4s;
          position: relative;
        }

        .line.hidden {
          opacity: 0;
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
