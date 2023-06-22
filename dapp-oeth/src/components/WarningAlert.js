import React from 'react'

const WarningAlert = ({ showWarning, text }) => {
  return showWarning ? (
    <>
      <div className="alert-warning d-flex justify-content-center">
        <p>{text}</p>
      </div>
      <style jsx>{`
        .alert-warning {
          border-radius: 5px;
          border: solid 1px #fec100;
          background-color: rgba(254, 193, 0, 0.1);
        }

        .alert-warning p {
          color: #183140;
          margin: 0pc;
          padding: 8px;
          font-size: 14px;
          text-align: center;
        }

        @media (max-width: 768px) {
          .alert-warning {
            margin: 0px 5px;
          }
        }
      `}</style>
    </>
  ) : (
    <></>
  )
}

export default WarningAlert
