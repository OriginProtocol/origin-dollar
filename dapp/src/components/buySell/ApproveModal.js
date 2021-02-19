import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import ApproveCurrencyRow from 'components/buySell/ApproveCurrencyRow'

import analytics from 'utils/analytics'

const ApproveModal = ({
  currenciesNeedingApproval,
  mintAmountAnalyticsObject,
  currenciesActive,
  onClose,
  onFinalize,
  buyWidgetState,
  onMintingError,
}) => {
  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const [approvedCurrencies, setApprovedCurrencies] = useState([])
  /* this is a weird solution to solve the race condition where if you click on 2 currency
   * approvals, before confirming metamask messages. The `approvedCurrencies` that gets
   * wrapped in the `onApprove` function of the `ApproveCurrencyRow` is outdated.
   *
   * The undesired result is that the second approval overrides the first one stores in the
   * `approvedCurrencies`. For that reason the convoluted `currencyToApprove` solution joined
   * with the `useEffect`
   *
   */
  const [currencyToApprove, setCurrencyToApprove] = useState(null)
  const allCurrenciesApproved =
    currenciesNeedingApproval.length === approvedCurrencies.length

  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  useEffect(() => {
    if (currencyToApprove) {
      setApprovedCurrencies([...approvedCurrencies, currencyToApprove])
      setCurrencyToApprove(null)
    }
  }, [currencyToApprove])

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
            <h2>{fbt('Approve to mint OUSD', 'Approve to mint OUSD')}</h2>
            <div className="currencies">
              {currenciesActive.map((coin, index) => {
                return (
                  <ApproveCurrencyRow
                    onApproved={() => {
                      setCurrencyToApprove(coin)
                    }}
                    isApproved={!currenciesNeedingApproval.includes(coin)}
                    key={coin}
                    coin={coin}
                    isLast={currenciesActive.length - 1 === index}
                    onMintingError={onMintingError}
                  />
                )
              })}
            </div>
          </div>
          <div className="body-actions d-flex align-items-center justify-content-center">
            {buyWidgetState === 'buy' && (
              <button
                disabled={!allCurrenciesApproved}
                className="btn-blue d-flex align-items-center justify-content-center"
                onClick={async (e) => {
                  e.preventDefault()
                  if (!allCurrenciesApproved) {
                    return
                  }

                  analytics.track('Mint Now clicked', {
                    location: 'Approve modal',
                    ...mintAmountAnalyticsObject,
                  })

                  await onFinalize()
                }}
              >
                {fbt('Mint OUSD', 'Mint OUSD')}
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
              fbt('Minting OUSD...', 'Minting OUSD...')}
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
