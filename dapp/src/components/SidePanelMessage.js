import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'

const SidePanelMessage = () => {
  return <>
    <div className="side-panel-message">
      <div className="title">
        {fbt('Welcome!', 'Welcome!')}
      </div>
      <div className="text">
        {fbt('The Treasury lets you easily convert other stablecoins into OUSD so you can instantly earn yields. You can buy up to ~365 OUSD with the 100 USDT, 25 USDC, and 240 DAI in your wallet.', 'welcome-message')}
      </div>
    </div>
    <style jsx>{`
      .side-panel-message {
        width: 100%;
        border-radius: 5px;
        border: solid 1px #cdd7e0;
        background-color: #ffffff;
        padding: 15px 20px;
        margin-bottom: 10px;
      }

      .side-panel-message .title {
        font-family: Lato;
        font-size: 14px;
        font-weight: bold;
        color: #1e313f;
        margin-bottom: 7px;
      }

      .side-panel-message .text {
        font-size: 14px;
        line-height: 1.36;
        color: #8293a4;
      }
    `}</style>
  </>
}

export default SidePanelMessage
