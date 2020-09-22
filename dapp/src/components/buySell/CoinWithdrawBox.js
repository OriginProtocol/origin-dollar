import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'

const CoinWithdrawBox = ({ coin, exchangeRate, amount, loading }) => {
  return (
    <>
      <div className="withdraw-box d-flex flex-column flex-grow active">
        <img
          className="mb-3 currency-image"
          src={`/images/currency/${coin}-radio-on.svg`}
        />
        <div className="exchange-rate d-none d-md-block">{`@ ${formatCurrency(
          exchangeRate,
          4
        )}/${coin.toUpperCase()}`}</div>
        <div className="exchange-rate d-md-none">{`@ ${formatCurrency(
          exchangeRate,
          4
        )}/${coin.toUpperCase()}`}</div>
        <hr />
        {loading && (
          <div className="d-flex justify-content-center my-auto">
            <img
              className="spinner rotating"
              src="/images/spinner-green-small.png"
            />
          </div>
        )}
        {!loading && (
          <div className="coin-value d-flex justify-content-center active">
            {formatCurrency(amount, 2)}
          </div>
        )}
      </div>
      <style jsx>{`
        .withdraw-box {
          padding: 15px 20px 8px 16px;
          min-height: 144px;
          min-width: 170px;
          border-radius: 5px;
          border: solid 1px #f2f3f5;
          background-color: #ffffff;
          margin-left: 10px;
          margin-right: 10px;
          background-color: #f2f3f5;
        }

        .withdraw-box.active {
          background-color: white;
          border: solid 1px #cbd7e1;
        }

        .exchange-rate {
          font-size: 12px;
          text-align: center;
          color: #8293a4;
        }

        .currency-image {
          height: 40px;
        }

        hr {
          width: 100%;
          max-width: 130px;
          height: 1px;
          background-color: #dde5ec;
          margin-bottom: 9px;
          margin-top: 8px;
          border: 0px;
        }

        .coin-value {
          font-size: 18px;
          text-align: center;
          color: #8293a4;
        }

        .coin-value.active {
          color: #00d592;
        }

        .coin-value.active::before {
          content: '+';
          color: #00d592;
          font-size: 18px;
        }

        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }

        .spinner {
          height: 18px;
          width: 18px;
        }

        @media (max-width: 799px) {
          .withdraw-box {
            padding: 10px;
            min-width: 105px;
            margin-left: 5px;
            margin-right: 5px;
          }
        }

        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

export default CoinWithdrawBox
