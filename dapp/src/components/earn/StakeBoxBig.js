import React from 'react'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'
import { formatRate } from 'utils/stake'
import { useWeb3React } from '@web3-react/core'

import GetOUSD from 'components/GetOUSD'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'

export default function StakeBoxBig({
  percentage,
  duration,
  subtitle,
  onClick,
  showLoadingWheel,
}) {
  const { active } = useWeb3React()

  return (
    <div className={`holder d-flex flex-row justify-content-between`}>
      <div className="d-flex flex-column align-items-start justify-content-start">
        <div className="d-flex">
          <span className="percentage">
            {formatRate(percentage)}%
            <span className="duration">
              {duration} {fbt('days', 'days')}
            </span>
          </span>
        </div>
        <div className="normal-text">
          {fbt('Annualized Yield', 'Annualized Yield')}
        </div>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="d-flex align-items-center justify-content-center">
        <button
          disabled={showLoadingWheel}
          className="d-flex align-items-center justify-content-center arrow-link"
          onClick={(e) => {
            if (active) {
              onClick(e)
            } else {
              document
                .getElementById('main-dapp-nav-connect-wallet-button')
                .click()
            }
          }}
        >
          {!showLoadingWheel && (
            <img className="caret-left" src="/images/caret-left.svg" />
          )}
          {showLoadingWheel && (
            <SpinningLoadingCircle backgroundColor="183140" />
          )}
        </button>
      </div>
      <style jsx>{`
        .holder {
          padding: 25px 25px 25px 30px;
          border-radius: 10px;
          box-shadow: 0 2px 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #dfe9ee;
          background-color: white;
        }

        .arrow-link {
          width: 40px;
          height: 40px;
          background-color: #183140;
          font-family: material;
          font-size: 22px;
          color: #fafbfc;
          border-radius: 25px;
          border: 0px;
        }

        .arrow-link:hover {
          background-color: #385160;
        }

        .caret-left {
          transform: rotate(180deg);
          width: 7px;
          height: 14px;
        }

        .percentage {
          font-size: 24px;
          font-weight: bold;
          color: black;
        }

        .duration {
          font-size: 14px;
          font-weight: bold;
          color: black;
          margin-left: 10px;
        }

        .normal-text {
          font-size: 14px;
          color: black;
          margin-top: 6px;
          margin-bottom: 13px;
        }

        .subtitle {
          font-size: 14px;
          color: #576c7a;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
