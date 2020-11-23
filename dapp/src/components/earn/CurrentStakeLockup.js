import React from 'react'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'

import { formatCurrencyMinMaxDecimals, formatCurrency } from 'utils/math'
import { enrichStakeData } from 'utils/stake'
import CircularProgressMeter from 'components/earn/CircularProgressMeter'

export default function CurrentStakeLockup({ stake }) {
  const enhancedStake = enrichStakeData(stake)

  return (
    <div className={`holder d-flex flex-column`}>
      <div className="top d-flex align-items-center justify-content-between">
        <div className="outer-circle d-flex align-items-center justify-content-center">
          <CircularProgressMeter rotate={true} />
        </div>
        <div className="title">
          {formatCurrencyMinMaxDecimals(enhancedStake.rate * 100, {
            minDecimals: 0,
            maxDecimals: 1,
          }) +
            '% - ' +
            enhancedStake.duration_days +
            ' ' +
            fbt('days', 'days')}
        </div>
        <button
          onClick={(e) => {
            console.log('SHOW MODAL Badabing badaboom')
          }}
          className="d-flex align-items-center justify-content-center arrow-link"
        >
          <img className="caret-left" src="/images/caret-left.svg" />
          <img className="caret-left hover" src="/images/caret-left-blue.svg" />
        </button>
      </div>
      <div className="bottom d-flex align-items-center justify-content-start">
        <span>
          <span className="smaller">{fbt('Principal', 'Principal')}</span>
          <span className="ml-2">
            {formatCurrency(enhancedStake.amount, 6)}
          </span>
          <span className="symbol smaller">+</span>
          <span className="smaller">{fbt('Interest', 'Interest')}</span>
          <span className="ml-2">
            {formatCurrency(enhancedStake.interest, 6)}
          </span>
          <span className="symbol smaller">=</span>
          <span className="smaller">{fbt('Total', 'Total')}</span>
          <span className="ml-2">{formatCurrency(enhancedStake.total, 6)}</span>
          <span className="ogn ml-2">OGN</span>
        </span>
      </div>
      <style jsx>{`
        .holder {
          border-radius: 10px;
          box-shadow: 0 2px 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #056ae3;
          width: 100%;
          margin-bottom: 20px;
          background-color: #1a82ff;
          color: white;
        }

        .top {
          border-radius: 10px 10px 0px 0px;
          background-color: #1a82ff;
          min-height: 80px;
          height: 80px;
          border-bottom: solid 1px #056ae3;
          position: relative;
          padding-left: 160px;
          padding-right: 25px;
        }

        .bottom {
          border-radius: 0px 0px 10px 10px;
          background-color: #0d73ed;
          min-height: 80px;
          height: 80px;
          padding-left: 160px;
          font-size: 20px;
          color: white;
        }

        .bottom .smaller {
          opacity: 0.8;
          font-size: 14px;
        }

        .bottom .ogn {
          font-size: 14px;
        }

        .bottom .symbol {
          padding-left: 32px;
          padding-right: 32px;
        }

        .arrow-link {
          width: 40px;
          height: 40px;
          font-family: material;
          font-size: 22px;
          color: white;
          border: 1px solid white;
          border-radius: 25px;
          background-color: transparent;
        }

        .arrow-link:hover {
          background-color: white;
        }

        .caret-left.hover {
          display: none;
        }

        .caret-left {
          transform: rotate(180deg);
          width: 7px;
          height: 14px;
        }

        .arrow-link:hover .caret-left {
          display: none;
        }

        .arrow-link:hover .caret-left.hover {
          display: block !important;
        }

        .title {
          font-size: 24px;
          font-weight: bold;
        }

        .outer-circle {
          position: absolute;
          transform: rotate(45deg);
          border-right: 1px solid #056ae3;
          border-bottom: 1px solid #056ae3;
          border-left: 1px solid #1a82ff;
          border-top: 1px solid #1a82ff;
          background-color: #1a82ff;
          width: 120px;
          height: 120px;
          border-radius: 60px;
          left: 20px;
          bottom: -60px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
