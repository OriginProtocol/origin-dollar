import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

const BalanceHeader = ({ balances }) => {

  return <div className="balance-header d-flex">
    <div className="blue-circle d-flex align-items-center justify-content-center flex-column">
      <div className="light-grey-label apy-label">APY</div>
      <div className="apy-percentage">15.34</div>
    </div>
    <div className="d-flex flex-column align-items-start justify-content-center">
      <div className="light-grey-label"><fbt desc="Current Balance">Current Balance</fbt></div>
      <div className="ousd-value">0.000000</div>
    </div>
  </div>
}

export default BalanceHeader

require('react-styl')(`
  .balance-header
    min-height: 200px
    padding: 35px
    .light-grey-label
      font-size: 14px
      font-weight: bold
      color: #8293a4
    .ousd-value
      font-size: 36px
      color: #1e313f
      &::after
        content: "OUSD"
        vertical-align: baseline
        color: #1e313f
        font-size: 14px
        margin-left: 8px
    .blue-circle
      width: 130px
      height: 130px
      border-radius: 65px
      border: solid 2px #1a82ff
      margin-right: 46px
      .apy-label
        margin-bottom: -8px
      .apy-percentage
        font-size: 36px
        text-align: center
        color: #1e313f
        margin-bottom: 5px
        &::after
          content: "%"
          font-size: 16px
          font-weight: bold
          color: #1e313f
          vertical-align: super

`)