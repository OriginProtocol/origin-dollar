import React, { useState } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'

import { formatCurrency } from 'utils/math'

const StakeDetailEquation = ({
  duration,
  durationText,
  rate,
  principal,
  forClaim,
}) => {
  const adjustedRate = (rate / 365) * (duration / (24 * 60 * 60))
  const parsedPrincipal = parseFloat(principal)
  const interest = adjustedRate * parsedPrincipal
  const precisionThreshold = 1000
  const precision = parsedPrincipal > precisionThreshold ? 0 : 4
  return (
    <>
      <div
        className={`stake-equation w-100 d-flex justify-content-between align-items-center${
          forClaim ? ' longText' : ''
        }`}
      >
        <div className="d-flex flex-column align-items-start">
          <div>
            {forClaim
              ? fbt('Claimable OGN:', 'Claimable OGN')
              : fbt('Principal', 'Principal')}
          </div>
          <div className="bottom">
            <b>{formatCurrency(principal, precision)}</b>
          </div>
        </div>
        <div>+</div>
        <div className="d-flex flex-column align-items-start">
          <div>
            {forClaim
              ? fbt('Staking Bonus:', 'Staking Bonus')
              : fbt('Interest', 'Interest')}
          </div>
          <div className="bottom">
            <b>{formatCurrency(interest, precision)}</b>
          </div>
        </div>
        <div>=</div>
        <div className="d-flex flex-column align-items-start">
          <div>
            {fbt(
              'Total after ' + fbt.param('duration in days', durationText),
              'Total amount with duration'
            )}
          </div>
          <div className="bottom">
            <b>{formatCurrency(parsedPrincipal + interest, precision)}</b>
          </div>
        </div>
      </div>
      <style jsx>{`
        .stake-equation {
          padding: 18px 25px;
          border-radius: 10px;
          background-color: #f1f3f6;
          font-family: Lato;
          font-size: 14px;
          color: #183140;
        }

        .bottom {
          margin-top: -5px;
        }

        @media (max-width: 576px) {
          .longText {
            padding: 18px 15px;
            font-size: 13px;
          }
        }
        @media (max-width: 340px) {
          .longText {
            padding: 18px 13px;
            font-size: 12px;
          }
        }
      `}</style>
    </>
  )
}

export default StakeDetailEquation
