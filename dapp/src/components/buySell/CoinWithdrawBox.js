import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'

import { currencies } from 'constants/Contract'
import { formatCurrency } from 'utils/math'
import { animateValue } from 'utils/animation'
import { assetRootPath } from 'utils/image'

const CoinWithdrawBox = ({
  coin,
  exchangeRate,
  amount,
  loading,
  className,
}) => {
  const [animatedAmount, setAnimatedAmount] = useState('')

  /* Contract will not redeem more than one stablecoin per OUSD. And because exchange rate prices
   * represent dollar value of a stablecoin for the mentioned reason the price can not go
   * below 1.
   */
  exchangeRate = Math.max(exchangeRate, 1.0)

  useEffect(() => {
    if (!amount) {
      return
    }

    const cancelAnimation = animateValue({
      from: parseFloat(animatedAmount) || 0,
      to: parseFloat(amount),
      callbackValue: (value) => {
        setAnimatedAmount(value)
      },
      duration: 300,
      id: `${coin}-sell-box`,
    })

    return cancelAnimation
  }, [amount])

  return (
    <>
      <div
        className={`withdraw-box d-flex flex-column flex-md-row justify-content-center justify-content-md-between align-items-center active col-4 ${
          className ? className : ''
        }`}
      >
        <img
          className="currency-image mr-1"
          src={assetRootPath(`/images/currency/${coin}-icon-small.svg`)}
        />
        <div className="d-flex flex-column">
          {loading && !animatedAmount ? (
            <div className="d-flex justify-content-center ml-md-auto">
              <img
                className="spinner rotating"
                src={assetRootPath('/images/spinner-green-small.png')}
              />
            </div>
          ) : (
            <div className="coin-value d-flex justify-content-center active ml-md-auto">
              {formatCurrency(animatedAmount, 2)}
            </div>
          )}
          <div className="exchange-rate d-none d-md-block">
            {`@ ${formatCurrency(exchangeRate, 4)}/${coin.toUpperCase()}`}
          </div>
          <div className="exchange-rate d-md-none">
            {`@ ${formatCurrency(exchangeRate, 4)}/${coin.toUpperCase()}`}
          </div>
        </div>
      </div>
      <style jsx>{`
        .withdraw-box {
          padding: 10px 15px;
          min-height: 50px;
          border: solid 1px #cbd7e1;
          background-color: #f2f3f5;
        }

        .withdraw-box.left {
          border-top-left-radius: 5px;
          border-bottom-left-radius: 5px;
        }

        .withdraw-box.no-left-border {
          border-left: 0px !important;
        }

        .withdraw-box.right {
          border-top-right-radius: 5px;
          border-bottom-right-radius: 5px;
        }

        .withdraw-box.active {
          border: solid 1px #cbd7e1;
        }

        .exchange-rate {
          font-size: 9px;
          text-align: center;
          color: #8293a4;
        }

        .currency-image {
          height: 24px;
          width: 24px;
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
          font-size: 12px;
          text-align: center;
          color: black;
        }

        .coin-value.active {
          color: black;
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
          }

          .coin-value {
            margin-top: 8px;
            margin-bottom: 5px;
          }

          .currency-image {
            height: 20px;
            width: 20px;
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
