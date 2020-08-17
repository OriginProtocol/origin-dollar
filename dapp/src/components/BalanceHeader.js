import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

const BalanceHeader = ({ balances }) => {

  return <>
    <div className="balance-header d-flex">
      <div className="blue-circle d-flex align-items-center justify-content-center flex-column">
        <div className="light-grey-labe apy-label">APY</div>
        <div className="apy-percentage">15.34</div>
      </div>
      <div className="d-flex flex-column align-items-start justify-content-center">
        <div className="light-grey-label">{fbt('Current Balance', 'Current Balance')}</div>
        <div className="ousd-value">0.000000</div>
      </div>
    </div>
    <style jsx>{`
      .balance-header {
        min-height: 200px;
        padding: 35px;
      }

      .balance-header .light-grey-label {
        font-size: 14px;
        font-weight: bold;
        color: #8293a4;
      }

      .balance-header .ousd-value {
        font-size: 36px;
        color: #1e313f;
      }

      .balance-header .ousd-value::after {
        content: "OUSD";
        vertical-align: baseline;
        color: #1e313f;
        font-size: 14px;
        margin-left: 8px;
      }

      .balance-header .blue-circle {
        width: 130px;
        height: 130px;
        border-radius: 65px;
        border: solid 2px #1a82ff;
        margin-right: 46px;
      }

      .balance-header .blue-circle .apy-label {
        margin-bottom: -8px;
      }

      .balance-header .blue-circle .apy-percentage {
        font-size: 36px;
        text-align: center;
        color: #1e313f;
        margin-bottom: 5px;
      }

      .balance-header .blue-circle .apy-percentage::after {
        content: "%";
        font-size: 16px;
        font-weight: bold;
        color: #1e313f;
        vertical-align: super;
      }
    `}</style>
  </>
}

export default BalanceHeader
  