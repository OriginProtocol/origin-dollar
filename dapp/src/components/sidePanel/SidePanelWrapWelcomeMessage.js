import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'

const SidePanelWelcomeMessage = () => {
  const ousdExchangeRates = useStoreState(
    ContractStore,
    (s) => s.ousdExchangeRates
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)

  const ousdToBuy = ['dai', 'usdt', 'usdc']
    .map((coin) => balances[coin] * ousdExchangeRates[coin].mint)
    .reduce((a, b) => a + b)

  return (
    <>
      <div className="side-panel-message">
        <div className="title">{fbt('Welcome!', 'Welcome!')}</div>
        <div className="text">
          {fbt(
            'Wrapped OUSD is a non-rebasing version of OUSD that still earns yield. This may provide tax benefits in some locations, and may be easier to use as a building block for other contracts.',
            'welcome-message'
          )}
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
          color: #183140;
          margin-bottom: 7px;
        }

        .side-panel-message .text {
          font-size: 14px;
          line-height: 1.5;
          color: #8293a4;
        }
      `}</style>
    </>
  )
}

export default SidePanelWelcomeMessage
