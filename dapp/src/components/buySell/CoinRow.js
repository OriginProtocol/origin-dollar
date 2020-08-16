import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import ToggleSwitch from 'components/buySell/ToggleSwitch'


const CoinRow = ({ coin }) => {
  const [coinValue, setCoinValue] = useState(123)

  return <div className="coin-row d-flex">
    <div className="coin-holder d-flex">
      <div className="coin-toggle">
        <ToggleSwitch
          coin={coin}
        />
      </div>
      <div className="coin-input d-flex align-items-center justify-content-start">
        <input
          type="number"
          className=""
          placeholder="0.00"
          value={coinValue}
          onChange={e => setCoinValue(e.target.value )}
        />
      </div>
    </div>
    <div className="coin-info d-flex">
      <div className="col-6 currency d-flex align-items-center justify-content-start">123</div>
      <div className="col-3 info d-flex align-items-center justify-content-center">qwe</div>
      <div className="col-3 info d-flex align-items-center justify-content-center">sadf</div>
    </div>
  </div>
}

export default CoinRow

require('react-styl')(`
  .coin-row
    margin-bottom: 11px
    .coin-holder
      width: 190px
      height: 49px
      border-radius: 5px
      border: solid 1px #cdd7e0
      .coin-toggle
        margin: -1px
        border-radius: 5px 0px 0px 5px
        border: solid 1px #cdd7e0
        background-color: #fafbfc
        height: 49px
        width: 70px
        min-width: 70px
      .coin-input
        width: 190px
        background-color: white
        border-radius: 0px 5px 5px 0px
        border: solid 1px #cdd7e0
        margin: -1px
        input
          width: 80%
          border: 0px
          font-size: 18px
          color: black
          margin-left: 15px
    .coin-info
      margin-left: 10px
      width: 350px
      height: 50px
      border-radius: 5px
      background-color: #f2f3f5
      .currency
        font-size: 18px
        color: #183140
      .info
        font-size: 12px
        color: #8293a4
`)
