import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

const SidePanelMessage = () => {

  return <div className="side-panel-message">
    <div className="title">
      <fbt desc="Welcome!">Welcome!</fbt>
    </div>
    <div className="text">
      <fbt desc="welcome-message">
        The Treasury lets you easily convert other stablecoins into OUSD so you can instantly earn yields. You can buy up to ~365 OUSD with the 100 USDT, 25 USDC, and 240 DAI in your wallet.
      </fbt>
    </div>
  </div>
}

export default SidePanelMessage

require('react-styl')(`
  .side-panel-message
    width: 270px
    border-radius: 5px
    border: solid 1px #cdd7e0
    background-color: #ffffff
    padding: 15px 20px
    .title
      font-family: Lato
      font-size: 14px
      font-weight: bold
      color: #1e313f
      margin-bottom: 7px
    .text
      font-size: 14px
      line-height: 1.36
      color: #8293a4
`)