import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import dateformat from 'dateformat'

import { formatCurrency } from 'utils/math'
import CircularProgressMeter from 'components/earn/CircularProgressMeter'
import { formatRate, durationToDays } from 'utils/stake'

const StakeDetailsModal = ({ stake, onClose }) => {
  return (
    <>
      <div
        className="stake-details-modal-overlay d-flex flex-column align-items-center justify-content-center"
        onClick={(e) => {
          onClose()
        }}
      >
        <div
          className="stake-modal shadowed-box d-flex flex-column align-items-center justify-content-center"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <button onClick={onClose} className="close-button">
            <img src="/images/close-button.svg" />
          </button>
          <div className="header d-flex w-100">
            <CircularProgressMeter stake={stake} rotate={false} bigger={true} />
            <div className="header-holder d-flex flex-column align-items-start justify-content-center">
              <div className="title">
                {fbt(
                  fbt.param('Stake rate', formatRate(stake.rate)) +
                    '% - ' +
                    fbt.param(
                      'Duration in days',
                      durationToDays(stake.duration)
                    ) +
                    ' days',
                  'Selected duration and staking rate'
                )}
              </div>
              <div className="status">{fbt('Status', 'Status')}</div>
            </div>
          </div>
          <div className="modal-body d-flex w-100 flex-column">
            <div className="stat-item">
              <div>{fbt('Lock-up Date', 'Lock-up Date')}</div>
              <div>{dateformat(stake.startDate, 'mm/dd/yyyy')}</div>
            </div>
            <div className="stat-item">
              <div>{fbt('Maturity Date', 'Maturity Date')}</div>
              <div>{dateformat(stake.endDate, 'mm/dd/yyyy')}</div>
            </div>
            <div className="stat-item">
              <div>{fbt('Duration', 'Duration')}</div>
              <div>
                {fbt(
                  fbt.param('days', stake.durationDays) + ' days',
                  'stake duration'
                )}
              </div>
            </div>
            <div className="stat-item">
              <div>{fbt('Interest Rate', 'Interest Rate')}</div>
              <div>{formatRate(stake.rate) + '%'}</div>
            </div>
            <div className="separator" />
            <div className="stat-item">
              <div>{fbt('Principal', 'Principal')}</div>
              <div>{formatCurrency(stake.amount, 2)}</div>
            </div>
            {/* <div className="stat-item"> */}
            {/*   <div>{fbt('Interest Accrued', 'Interest Accrued')}</div> */}
            {/*   <div>{formatCurrency(stake.interest, 6)}</div> */}
            {/* </div> */}
            <div className="stat-item">
              <div>
                <b>{fbt('Maturity Amount', 'Maturity Amount')}</b>
              </div>
              <div>
                {formatCurrency(stake.total, 2)}
                {' OGN'}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .stake-details-modal-overlay {
          position: absolute;
          background-color: rgba(24, 49, 64, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 5;
        }

        .stake-modal {
          place-self: center;
          min-width: 600px;
          border-radius: 10px;
          box-shadow: 0 0 24px 0 rgba(0, 0, 0, 0.2);
          border: solid 1px #056ae3;
          background-color: #0d73ed;
          position: relative;
          color: white;
        }

        button.close-button {
          border: 0px;
          opacity: 0.75;
          background-color: transparent;
          position: absolute;
          right: 22px;
          top: 22px;
        }

        button.close-button:hover {
          opacity: 1;
        }

        .header {
          background-color: #007cff;
          border-bottom: solid 1px #056ae3;
          border-radius: 10px 10px 0px 0px;
          padding: 40px;
          height: 200px;
        }

        .header-holder {
          margin-left: 40px;
        }

        .title {
          font-family: Poppins;
          font-size: 38px;
          font-weight: 500;
          color: white;
        }

        .modal-body {
          padding: 40px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .stat-item div:first-child {
          opacity: 0.8;
          font-size: 18px;
        }

        .separator {
          height: 1px;
          margin-top: 6px;
          margin-bottom: 24px;
          background-color: #005fd1;
          width: 100%;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default StakeDetailsModal
