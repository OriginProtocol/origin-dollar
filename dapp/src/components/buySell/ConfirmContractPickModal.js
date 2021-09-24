import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { formatCurrency } from 'utils/math'
import { capitalize } from 'utils/utils'

import analytics from 'utils/analytics'

const ConfirmContractPickModal = ({
  onClose,
  setConfirmAlternateRoute,
  bestEstimation,
  estimationSelected,
  nameMapping,
}) => {
  return (
    <>
      <div className="contract-approve-modal d-flex" onClick={onClose}>
        <div
          className="modal-body shadowed-box d-flex flex-column"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="body-content d-flex flex-column">
            <h2>{fbt('Confirm', 'Confirm alternate transaction route')}</h2>
            <div className="currencies">
              {fbt(
                fbt.param(
                  'selected estimation name',
                  nameMapping[estimationSelected.name].name
                ) +
                  ' offers -' +
                  fbt.param(
                    'selected estimation diff',
                    formatCurrency(estimationSelected.diffPercentage * -1, 2)
                  ) +
                  '% ' +
                  ' worse price than ' +
                  fbt.param(
                    'best estimation name',
                    nameMapping[bestEstimation.name].name
                  ) +
                  '.',
                'Selected vs best estimation comparison'
              )}{' '}
              {fbt(
                'Are you sure you want to override best transaction route?',
                'transaction route override prompt'
              )}
            </div>
          </div>
          <div className="body-actions d-flex align-items-center justify-content-center">
            <button
              className="btn-clear-blue d-flex align-items-center justify-content-center mr-2"
              onClick={async (e) => {
                setConfirmAlternateRoute(false)
                analytics.track('On deny tx route change', {
                  category: 'settings',
                  label: estimationSelected.name,
                })
                onClose()
              }}
            >
              {fbt('No', 'I do not confirm contract change')}
            </button>
            <button
              className="btn-blue d-flex align-items-center justify-content-center ml-2"
              onClick={async (e) => {
                setConfirmAlternateRoute(true)
                analytics.track('On confirm tx route change', {
                  category: 'settings',
                  label: estimationSelected.name,
                })
                onClose()
              }}
            >
              {fbt('Yes', 'I confirm contract change')}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .contract-approve-modal {
          position: absolute;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: rgba(250, 251, 252, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 10;
          padding-left: 80px;
          padding-right: 80px;
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

        .body-content {
          color: black;
          text-align: center;
          padding: 20px;
        }

        .body-content h2 {
          font-size: 25px;
          margin-bottom: 18px;
        }

        .body-actions {
          min-height: 95px;
          background-color: #f2f3f5;
          border-radius: 0px 0px 10px 10px;
          border-top: solid 1px #cdd7e0;
        }

        button {
          padding: 0px 60px;
          height: 50px;
          border-radius: 25px;
          font-size: 18px;
        }

        @media (max-width: 799px) {
          .contract-approve-modal {
            padding-left: 30px;
            padding-right: 30px;
          }

          button {
            padding: 0px 50px;
          }
        }
      `}</style>
    </>
  )
}

export default ConfirmContractPickModal
