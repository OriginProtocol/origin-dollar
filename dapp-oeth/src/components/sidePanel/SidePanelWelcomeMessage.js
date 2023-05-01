import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'

const SidePanelWelcomeMessage = () => {
  const oethExchangeRates = useStoreState(
    ContractStore,
    (s) => s.oethExchangeRates
  )
  const balances = useStoreState(AccountStore, (s) => s.balances)

  const oethToBuy = ['weth', 'frxeth', 'reth', 'steth']
    .map((coin) => balances[coin] * oethExchangeRates[coin].mint)
    .reduce((a, b) => a + b)

  return (
    <>
      <div className="side-panel-message">
        <div className="title">{fbt('Welcome!', 'Welcome!')}</div>
        <div className="text">
          {fbt(
            `The Origin Dollar lets you easily convert other stablecoins into OUSD so you can instantly earn yields.`,
            'welcome-message'
          )}{' '}
          {oethToBuy > 0 &&
            fbt(
              'You can buy up to ~' +
                fbt.param('oeth-coin', formatCurrency(oethToBuy 6)) +
                ' OETH with the ' +
                fbt.param('weth-coin', formatCurrency(balances['weth'], 0)) +
                ' WETH, ' +
                fbt.param('reth-coin', formatCurrency(balances['reth'], 0)) +
                ' rETH, ' +
                fbt.param('frxeth-coin', formatCurrency(balances['frxeth'], 0)) +
                ' frxETH, and ' +
                fbt.param('steth-coin', formatCurrency(balances['steth'], 0)) +
                ' stETH in your wallet.',
              'welcome-message-buying-power'
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
