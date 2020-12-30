import React, { useState } from 'react'
import { useStoreState } from 'pullstate'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'

import AccountStore from 'stores/AccountStore'
import BalanceHeader from 'components/buySell/BalanceHeader'
import BuySellWidget from 'components/buySell/BuySellWidget'
import GetOUSD from 'components/GetOUSD'

const MissionControl = ({}) => {
  const { active } = useWeb3React()

  return (
    <>
      <div className="content-holder flex-grow d-flex flex-column shadow-div">
        <BalanceHeader />
        {active && <BuySellWidget />}
        {!active && (
          <div className="empty-placeholder d-flex flex-column align-items-center justify-content-start">
            <img src="/images/wallet-icons.svg" />
            <div className="header-text">
              {fbt('No wallet connected', 'Disconnected dapp message')}
            </div>
            <div className="subtext">
              {fbt(
                'Please connect an Ethereum wallet',
                'Disconnected dapp subtext'
              )}
            </div>
            <GetOUSD primary connect trackSource="Dapp widget body" />
          </div>
        )}
      </div>
      <style jsx>{`
        .content-holder {
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          max-width: 716px;
          min-width: 630px;
        }

        .shadow-div {
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
        }

        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 0 0 10px 10px;
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .header-text {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-top: 23px;
          margin-bottom: 10px;
        }

        .subtext {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #8293a4;
          margin-bottom: 50px;
        }

        @media (max-width: 799px) {
          div {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }

          .content-holder {
            max-width: 100%;
            min-width: 100%;
          }
        }
      `}</style>
    </>
  )
}

export default MissionControl
