import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math.js'

const CoinWithdrawBox = ({
  coin,
  active,
  onClick,
  exchangeRate,
  ousdAmount,
}) => {
  return (
    <>
      <div
        className={`withdraw-box d-flex flex-column flex-grow ${
          active ? 'active' : ''
        }`}
        onClick={onClick}
      >
        <img
          className="mb-3 currency-image"
          src={`/images/currency/${coin}-radio-${active ? 'on' : 'off'}.svg`}
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
        <div className={`coin-value ${active ? 'active' : ''}`}>
          {active ? formatCurrency(ousdAmount / exchangeRate) : '0.00'}
        </div>
      </div>
      <style jsx>{`
        .withdraw-box {
          padding: 19px 20px 17px 20px;
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

        .withdraw-box:hover {
          cursor: pointer;
        }

        .exchange-rate {
          font-size: 12px;
          text-align: center;
          color: #8293a4;
        }

        .currency-image {
          height: 50px;
        }

        hr {
          width: 100%;
          height: 1px;
          background-color: #dde5ec;
          margin-bottom: 12px;
          margin-top: 12px;
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
            min-width: auto;
            flex: 1 0 0;
            width: 30%;
            margin: 0 0.5%;
          }
        }
      `}</style>
    </>
  )
}

export default CoinWithdrawBox
