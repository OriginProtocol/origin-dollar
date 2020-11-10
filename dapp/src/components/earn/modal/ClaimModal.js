import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'

import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import { useStoreState } from 'pullstate'

const ClaimModal = ({ pool, onClose, onUserConfirmedClaimTx, onError }) => {
  // show-ogn-to-claim, claim-user-wait
  const [modalState, setModalState] = useState('show-ogn-to-claim')
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)

  const getActions = () => {
    if (modalState === 'show-ogn-to-claim') {
      return [
        {
          text: fbt('Claim', 'Claim'),
          isDisabled: false,
          onClick: async () => {
            setModalState('claim-user-wait')
            const result = await pool.contract.claim()
            onUserConfirmedClaimTx(result)
            onClose()
          },
        },
      ]
    }
  }

  return (
    <>
      <EarnModal
        closeable={(e) => {
          if (modalState === 'show-ogn-to-claim') {
            return true
          }
          return false
        }}
        onClose={onClose}
        bodyContents={
          <div className="d-flex flex-column align-items-center justify-content-center">
            <div className="ogn-to-claim">{formatCurrency(pool.claimable_ogn, 2)}</div>
            <div className="d-flex mb-33 align-items-center">
              <img className="ogn-icon" src="/images/ogn-icon-blue.svg" />
              <div className="grey-text">
                {fbt('Unclaimed OGN', 'Unclaimed OGN')}
              </div>
            </div>
            <div className="grey-text mb-30">
              {fbt(
                'Your LP tokens will remain staked',
                'Your LP tokens will remain staked'
              )}
            </div>
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
                  src={`/images/${connectorIcon}`}
                />
                <div className="action-text">
                  {fbt(
                    'Please finalize your transaction…',
                    'Finalize your transaction'
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
          margin-bottom: 10px;
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

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default ClaimModal
