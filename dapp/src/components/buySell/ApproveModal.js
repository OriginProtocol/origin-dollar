import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { get } from 'lodash'

import AccountStore from 'stores/AccountStore'
import ApproveCurrencyRow from 'components/buySell/ApproveCurrencyRow'
import analytics from 'utils/analytics'
import { connectorNameIconMap, getConnectorIcon } from 'utils/connectors'

const ApproveModal = ({
  swapMetadata,
  swapMode,
  stableCoinToApprove,
  onClose,
  contractToApprove,
  onFinalize,
  buyWidgetState,
  onMintingError,
}) => {
  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const [coinApproved, setCoinApproved] = useState(false)
  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
  const connectorIcon = getConnectorIcon(connectorName)

  return (
    <>
      <div className="approve-modal d-flex" onClick={onClose}>
        <div
          className="modal-body shadowed-box d-flex flex-column"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="body-coins d-flex flex-column">
            <h2>{fbt('Approve to swap OUSD', 'Approve to swap OUSD')}</h2>
            <div className="currencies">
              <ApproveCurrencyRow
                onApproved={() => {
                  setCoinApproved(true)
                }}
                contractToApprove={contractToApprove}
                isApproved={coinApproved}
                coin={stableCoinToApprove}
                isLast={true}
                swapMetadata={swapMetadata}
                onMintingError={onMintingError}
              />
            </div>
          </div>
          <div className="body-actions d-flex align-items-center justify-content-center">
            {buyWidgetState === 'buy' && (
              <button
                disabled={!coinApproved}
                className="btn-blue d-flex align-items-center justify-content-center"
                onClick={async (e) => {
                  e.preventDefault()
                  if (!coinApproved) {
                    return
                  }

                  analytics.track(
                    swapMode === 'mint'
                      ? 'On Swap to OUSD'
                      : 'On Swap from OUSD',
                    {
                      category: 'swap',
                      label: swapMetadata.stablecoinUsed,
                      value: swapMetadata.swapAmount,
                    }
                  )
                  await onFinalize()
                }}
              >
                {fbt('Swap', 'Swap')}
              </button>
            )}
            {buyWidgetState === 'modal-waiting-user' && (
              <div className="d-flex align-items-center justify-content-center">
                <img
                  className="waiting-icon"
                  src={`/images/${connectorIcon}`}
                />
                {fbt(
                  'Waiting for you to confirm...',
                  'Waiting for you to confirm...'
                )}
              </div>
            )}
            {buyWidgetState === 'modal-waiting-network' &&
              fbt('Swapping OUSD...', 'Swapping OUSD...')}
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
          padding-left: 110px;
          padding-right: 110px;
        }

        .approve-modal h2 {
          font-size: 18px;
          font-weight: bold;
          color: #183140;
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

        .waiting-icon {
          width: 30px;
          height: 30px;
          margin-right: 10px;
        }

        @media (max-width: 799px) {
          .approve-modal {
            padding-left: 30px;
            padding-right: 30px;
          }
        }
      `}</style>
    </>
  )
}

export default ApproveModal
