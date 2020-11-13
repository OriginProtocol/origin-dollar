import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'

import AccountStore from 'stores/AccountStore'
import RouterStore from 'stores/RouterStore'

const SidePanelStakeMessage = () => {
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const routerHistory = useStoreState(RouterStore, (s) => s.history)
  const previousPath =
    routerHistory.length > 1 ? routerHistory[routerHistory.length - 2] : ''
  const linkTo = previousPath.toLowerCase().startsWith('/dapp/pool/')
    ? previousPath
    : '/dapp/earn'
  console.log('Previous Path: ', previousPath, linkTo)

  return (
    <>
      <div className="side-panel-message d-flex flex-column align-items-center justify-content-center">
        <img className="ogn-icon" src="/images/ogn-icon-blue.svg" />
        <div>
          {fbt(
            "You're ready to provide liquidity and stake to earn OGN",
            'Stake information panel message'
          )}
        </div>
        <Link href={linkTo}>
          <a className="btn-dark">{fbt('Continue', 'Continue')}</a>
        </Link>
      </div>
      <style jsx>{`
        .side-panel-message {
          width: 100%;
          border-radius: 5px;
          min-height: 160px;
          background-color: #1a82ff;
          padding: 20px 25px 14px 25px;
          margin-bottom: 10px;
          background-image: url('/images/earn-coin-waves-blue.svg');
          background-repeat: no-repeat;
          background-position: center top;
          background-size: contain;
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: normal;
          text-align: center;
          color: white;
        }

        .ogn-icon {
          width: 50px;
          height: 50px;
          margin-bottom: 5px;
        }

        .btn-dark {
          font-size: 12px;
          font-weight: bold;
          text-align: center;
          color: white;
          height: 25px;
          margin-top: 13px;
          padding: 3px 25px;
        }
      `}</style>
    </>
  )
}

export default SidePanelStakeMessage
