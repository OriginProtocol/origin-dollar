import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math.js'

const CoinWithdrawBox = ({ coin, exchangeRate, amount }) => {
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
          2
        )}/${coin.toUpperCase()}`}</div>
        <hr />
        <div className="coin-value d-flex justify-content-center active">
          {formatCurrency(amount)}
        </div>
      </div>
      <style jsx>{`
        .withdraw-box {
          padding: 15px 20px 8px 16px;
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

        @media (max-width: 799px) {
          .withdraw-box {
            padding: 10px;
            min-width: 105px;
            margin-left: 5px;
            margin-right: 5px;
          }
        }
      `}</style>
    </>
  )
}

export default CoinWithdrawBox
