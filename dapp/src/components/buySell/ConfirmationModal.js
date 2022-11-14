import React from 'react'
import { fbt } from 'fbt-runtime'
import { Modal } from 'react-bootstrap'
const ConfirmationModal = ({
  onClose,
  onConfirm,
  description,
  declineBtnText,
  confirmBtnText,
}) => {
  return (
    <>
      <Modal
        show={true}
        size="lg"
        aria-labelledby="confirmation-modal"
        centered
      >
        <div className="body-content d-flex flex-column">
          <h2>{fbt('Confirm', 'Confirm')}</h2>
          <div className="currencies">{description}</div>
        </div>
        <div className="body-actions d-flex align-items-center justify-content-center">
          <button
            className="btn-clear-blue d-flex align-items-center justify-content-center mr-2"
            onClick={onClose}
          >
            {declineBtnText}
          </button>
          <button
            className="btn-blue d-flex align-items-center justify-content-center ml-2"
            onClick={onConfirm}
          >
            {confirmBtnText}
          </button>
        </div>
      </Modal>
      <style jsx>{`
        .body-content {
          color: black;
          text-align: center;
          padding: 20px;
        }

        .body-content h2 {
          font-size: 25px;
          margin-bottom: 18px;
          font-weight: bold;
          color: #183140;
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
      `}</style>
    </>
  )
}

export default ConfirmationModal
