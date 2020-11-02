import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'

import { usePrevious } from 'utils/hooks'

/* Actions needs to be a modal of elements where each element has:
 *  - text
 *  - isDisabled
 *  - onClick
 *
 * closeable -> as per word definition: "That which can be closed". Closeable modals will show a close button on top right
 * closeIt -> If modal content defined outside this class wants to close this modal, it should set the closeIt to true
 */
const EarnModal = ({
  closeable,
  closeIt,
  onClose,
  bodyContents,
  title,
  actions,
  isWaitingForTxConfirmation,
  isWaitingForNetwork,
}) => {
  const [open, setOpen] = useState(true)

  // previous values
  const prevOpen = usePrevious(open)
  const prevCloseIt = usePrevious(closeIt)

  useEffect(() => {
    if ((prevOpen && !open) || (prevCloseIt && !closeIt)) {
      onClose()
    }
  }, [closeIt, open])

  return (
    <>
      <div
        className="earn-modal-overlay d-flex align-items-center justify-content-center"
        onClick={(e) => {
          // so the modal doesn't close
        }}
      >
        <div
          className="earn-modal shadowed-box d-flex flex-column align-items-center justify-content-center"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="earn-modal-body w-100">
            <div className="d-flex justify-content-between w-100">
              <div className="title">{title}</div>
              <button onClick={(e) => {}} className="close-button">
                <img src="/images/close-button.svg" />
              </button>
            </div>
            <hr />
            {bodyContents}
          </div>
          {actions && (
            <div className="actions w-100 d-flex flex-column flex-md-row justify-content-center align-items-center">
              {actions.map((action, index) => {
                return (
                  <button
                    key={index}
                    disabled={action.isDisabled}
                    className="btn-dark"
                    onClick={action.onClick}
                  >
                    {action.text}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .earn-modal-overlay {
          position: absolute;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: rgba(24, 49, 64, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 5;
        }

        .earn-modal {
          background-color: white;
          place-self: center;
          min-width: 540px;
        }

        .earn-modal-body {
          padding: 30px 30px 0px 30px;
        }

        .title {
          font-size: 24px;
          font-weight: bold;
          color: black;
        }

        hr {
          width: 100%;
          border-top: 1px solid #cdd7e0;
          margin-bottom: 24px;
          margin-top: 27px;
        }

        button.close-button {
          border: 0px;
          opacity: 0.75;
          background-color: transparent;
        }

        button.close-button:hover {
          opacity: 1;
        }

        .actions {
          min-height: 111px;
          background-color: #fafbfc;
          border-radius: 0px 0px 20px 20px;
          border-top: 1px solid #cdd7e0;
        }

        .btn-dark {
          min-width: 190px;
          min-height: 50px;
        }

        @media (max-width: 799px) {
          .earn-modal {
            padding-left: 30px;
            padding-right: 30px;
          }

          .btn-dark {
            min-width: 100%;
          }
        }
      `}</style>
    </>
  )
}

export default EarnModal
