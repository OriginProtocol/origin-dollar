import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'

const BuySellModal = ({ onBackgroundClick, content }) => {
  return (
    <>
      <div
        className="buy-sell-modal d-flex"
        onClick={(e) => {
          if (onBackgroundClick) {
            onBackgroundClick()
          }
        }}
      >
        <div
          className="modal-body shadowed-box d-flex align-items-center justify-content-center"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          {content}
        </div>
      </div>
      <style jsx>{`
        .buy-sell-modal {
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

        .modal-body {
          background-color: white;
          place-self: center;
          padding: 30px 20px;
        }

        @media (max-width: 799px) {
          .buy-sell-modal {
            padding-left: 30px;
            padding-right: 30px;
          }
        }
      `}</style>
    </>
  )
}

export default BuySellModal
