import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

import CoinRow from 'components/buySell/CoinRow'

const BuySellWidget = () => {
  const [tab, setTab] = useState('buy')

  return <div className="buy-sell-widget d-flex flex-column">
    <div className="tab-navigation">
      <a
        onClick={e => {
          e.preventDefault()
          setTab('buy')
        }}
        className={`${tab === 'buy' ? 'active' : ''}`}
      >
        <fbt desc="Buy OUSD">Buy OUSD</fbt>
      </a>
      <a
        onClick={e => {
          e.preventDefault()
          setTab('sell')
        }}
        className={`${tab === 'sell' ? 'active' : ''}`}
      >
        <fbt desc="Sell OUSD">Sell OUSD</fbt>
      </a>
    </div>
    {tab === 'buy' && <div className="coin-table">
      <div className="header d-flex">
        <div><fbt desc="Asset">Asset</fbt></div>
        <div className="ml-auto"><fbt desc="Exchange Rate">Exchange Rate</fbt></div>
        <div><fbt desc="Your Balance">Your Balance</fbt></div>
      </div>
      <CoinRow
        coin="dai"
      />
      <CoinRow
        coin="usdt"
      />
      <CoinRow
        coin="usdc"
      />
      <div className="horizontal-break d-flex align-items-center justify-content-center">
        <img src="/images/down-arrow.svg"/>
      </div>
      <div className="ousd-section d-flex justify-content-between">
        <div className="approx-purchase d-flex align-items-center justify-content-start">
          <div>
            <fbt desc="Approx. purchase amount">Approx. purchase amount</fbt>
          </div>
          <a
            className="ml-2"
            onClick={ e => {
              e.preventDefault()
            }}>
            <img className="question-icon" src="/images/question-icon.svg"/>
          </a>
        </div>
        <div className="ousd-estimation d-flex align-items-center justify-content-start">
          <img src="/images/currency/ousd-icon.svg"/>
          <div className="value">3.3 OUSD</div>
          <div className="balance ml-auto">0.00 OUSD</div>
        </div>
      </div>
      <div className="actions d-flex justify-content-end">
        <button
          className="btn-blue"
          onClick={e => {
            e.preventDefault()

          }}
        >
          <fbt desc="Buy now">Buy now</fbt>
        </button>
      </div>
    </div>}
  </div>
}

export default BuySellWidget

require('react-styl')(`
  .buy-sell-widget
    margin: 0px -1px -1px -1px
    border-radius: 0px 0px 10px 10px
    border: solid 1px #cdd7e0
    background-color: #fafbfc
    min-height: 470px
    padding: 25px 40px 40px 40px
    .header
      font-size: 12px
      font-weight: bold
      color: #8293a4
      margin-top: 18px
      margin-bottom: 9px
      >div
        width: 87px
    .tab-navigation
      a
        font-size: 14px
        font-weight: bold
        color: #1a82ff
        padding-bottom: 5px
        margin-right: 40px
        cursor: pointer
      a.active
        color: #1e313f
        border-bottom: solid 1px #1e313f
    .horizontal-break
      width: 100%
      height: 1px
      background-color: #dde5ec
      margin-top: 20px
      margin-bottom: 30px
    .ousd-section
      margin-bottom: 31px
      .approx-purchase
        min-width: 190px
        font-size: 12px
        font-weight: bold
        color: #8293a4
      .ousd-estimation
        width: 350px
        height: 50px
        border-radius: 5px
        border: solid 1px #cdd7e0
        background-color: #f2f3f5
        padding: 14px
        .value
          font-size: 18px
          color: black
          margin-left: 10px
        .balance
          font-size: 12px
          color: #8293a4

`)