import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { get } from 'lodash'

import AccountStore from 'stores/AccountStore'
import { connectorNameIconMap, getConnectorIcon } from 'utils/connectors'
import { assetRootPath } from 'utils/image'

const ErrorModal = ({
  error,
  errorMap,
  onClose,
  showRefreshButton,
  reason,
}) => {
  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
  const connectorIcon = getConnectorIcon(connectorName)

  const errorTxt = () => {
    const errorMetadata = errorMap.filter((eMeta) => eMeta.errorCheck(error))[0]

    if (errorMetadata) {
      return errorMetadata.friendlyMessage
    }

    return error.message
  }

  return (
    <>
      <div className="error-modal d-flex" onClick={onClose}>
        <div
          className="error-modal-body shadowed-box d-flex flex-column"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="body-coins d-flex flex-column">
            <div className="d-flex align-items-center error">
              <img
                className="connector-icon"
                src={assetRootPath(`/images/${connectorIcon}`)}
              />
              {reason !== undefined && reason}
              {errorMap && errorTxt()}
            </div>
          </div>
          <div className="body-actions d-flex align-items-center justify-content-center">
            {showRefreshButton && (
              <div>
                <button
                  className="btn-blue mt-4"
                  onClick={(e) => {
                    location.reload()
                  }}
                >
                  {fbt('Refresh', 'Refresh')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .error-modal {
          position: absolute;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: rgba(250, 251, 252, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 2;
          padding-left: 110px;
          padding-right: 110px;
        }

        .error-modal-body {
          background-color: white;
          place-self: center;
          padding: 20px;
        }

        .error-modal-body .error {
          color: rgb(237 41 40);
          line-height: 1.3;
        }

        .connector-icon {
          width: 30px;
          height: 30px;
          margin-right: 15px;
        }

        @media (max-width: 799px) {
          .error-modal {
            padding-left: 30px;
            padding-right: 30px;
          }
        }
      `}</style>
    </>
  )
}

export default ErrorModal
