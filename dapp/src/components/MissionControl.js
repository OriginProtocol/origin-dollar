import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import BalanceHeader from 'components/buySell/BalanceHeader'
import BuySellWidget from 'components/buySell/BuySellWidget'

const MissionControl = ({}) => {
  const allowances = useStoreState(AccountStore, (s) => s.allowances)
  const balances = useStoreState(AccountStore, (s) => s.balances)
  const account = useStoreState(AccountStore, (s) => s.address)

  return (
    <>
      <div className="flex-grow d-flex flex-column">
        <BalanceHeader balances={balances} />
        <BuySellWidget />
      </div>
      <style jsx>{`
        div {
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          max-width: 716px;
          min-width: 630px;
        }

        @media (max-width: 799px) {
          div {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }
        }
      `}</style>
    </>
  )
}

export default MissionControl
