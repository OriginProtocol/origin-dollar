import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

const ContractsTable = ({ subtitle = 'Subtitle is not set' }) => {
  return (
    <>
      <div className="d-flex flex-column contracts-table">
        <div className="pl-40 title">
          {fbt('Contracts', 'Contracts table title')}
        </div>
        <div className="pl-40 subtitle">{subtitle}</div>
      </div>
      <div className="d-flex flex-column">
        <div className="d-flex title-row pl-40">
          <div className="w-28">{fbt('Name', 'Contract Table Name')}</div>
          <div className="w-18">
            {fbt('Est. received', 'Contract Table Est. received')}
          </div>
          <div className="w-18">
            {fbt('Gas estimate', 'Contract Table Gas estimate')}
          </div>
          <div className="w-18">
            {fbt('Effective Price', 'Contract Table Effective Price')}
          </div>
          <div className="w-18">{fbt('Diff', 'Contract Table Diff')}</div>
        </div>
        <div className="d-flex content-row pl-40 selected">
          <div className="w-28">
            {fbt('Origin Swap', 'Contract Table Origin Swap')}
          </div>
          <div className="w-18">99.95</div>
          <div className="w-18">$17.00</div>
          <div className="w-18">0.96</div>
          <div className="w-18">Best</div>
        </div>
        <div className="d-flex content-row pl-40">
          <div className="w-28">
            {fbt('Origin Swap', 'Contract Table Origin Swap')}
          </div>
          <div className="w-18">99.95</div>
          <div className="w-18">$17.00</div>
          <div className="w-18">0.96</div>
          <div className="w-18">Best</div>
        </div>
      </div>
      <style jsx>{`
        .contracts-table {
          color: #8293a4;
          font-size: 14px;
        }

        .pl-40 {
          padding-left: 40px;
        }

        .w-28 {
          width: 28%;
        }

        .w-18 {
          width: 18%;
        }

        .title {
          font-weight: bold;
          margin-top: 47px;
          margin-bottom: 9px;
        }

        .subtitle {
          margin-bottom: 36px;
        }

        .title-row {
          color: #8293a4;
          font-size: 12px;
          margin-bottom: 18px;
        }

        .content-row {
          color: black;
          font-size: 14px;
          padding-top: 9px;
          padding-bottom: 10px;
        }

        .content-row.selected {
          background-color: #faf6d9;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default ContractsTable
