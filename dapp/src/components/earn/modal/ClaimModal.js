import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { get } from 'lodash'

import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import { useStoreState } from 'pullstate'
import { connectorNameIconMap, getConnectorIcon } from 'utils/connectors'
import { assetRootPath } from 'utils/image'

const ClaimModal = ({
  onClaimContractCall,
  ognToClaim,
  onClose,
  onUserConfirmedClaimTx,
  onError,
  infoText,
}) => {
  // show-ogn-to-claim, claim-user-wait
  const [modalState, setModalState] = useState('show-ogn-to-claim')
  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
  const connectorIcon = getConnectorIcon(connectorName)

  const getActions = () => {
    if (modalState === 'show-ogn-to-claim') {
      return [
        {
          text: fbt('Claim', 'Claim'),
          isDisabled: false,
          onClick: async () => {
            try {
              setModalState('claim-user-wait')
              const result = await onClaimContractCall()
              onUserConfirmedClaimTx(result)
              onClose()
            } catch (e) {
              onError(e)
              onClose()
            }
          },
        },
      ]
    }
  }

  return (
    <>
      <EarnModal
        closeable={(() => {
          if (modalState === 'show-ogn-to-claim') {
            return true
          }
          return false
        })()}
        onClose={onClose}
        bodyContents={
          <div className="d-flex flex-column align-items-center justify-content-center">
            <div className="ogn-to-claim">{formatCurrency(ognToClaim, 6)}</div>
            <div
              className={`d-flex align-items-center ${infoText ? 'mb-33' : ''}`}
            >
              <img
                className="ogn-icon"
                src={assetRootPath('/images/ogn-icon-blue.svg')}
              />
              <div className="grey-text">
                {fbt('Unclaimed OGN', 'Unclaimed OGN')}
              </div>
            </div>
            <div className="grey-text mb-30">{infoText ? infoText : ''}</div>
          </div>
        }
        title={fbt('Claim OGN', 'Claim OGN')}
        actions={getActions()}
        actionsBody={
          <>
            {['claim-user-wait'].includes(modalState) && (
              <div className="d-flex align-items-center justify-content-center">
                <img
                  className="big-connector-icon"
                  src={assetRootPath(`/images/${connectorIcon}`)}
                />
                <div className="action-text">
                  {fbt(
                    'Please confirm your transaction…',
                    'Confirm your transaction'
                  )}
                </div>
              </div>
            )}
          </>
        }
      />
      <style jsx>{`
        .ogn-to-claim {
          font-size: 36px;
          color: black;
          margin-bottom: 2px;
        }

        .ogn-icon {
          width: 20px;
          height: 20px;
          margin-right: 7px;
        }

        .mb-33 {
          margin-bottom: 33px;
        }

        .mb-30 {
          margin-bottom: 30px;
        }

        .big-connector-icon {
          width: 42px;
          height: 42px;
          margin-right: 20px;
        }

        .action-text {
          font-size: 18px;
          color: #1e313f;
        }

        .grey-text {
          font-size: 14px;
          color: #8293a4;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default ClaimModal
