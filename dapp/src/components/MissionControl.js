import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import BalanceHeader from 'components/buySell/BalanceHeader'
import BuySellWidget from 'components/buySell/BuySellWidget'

const MissionControl = ({}) => {
  const ousdBalance = useStoreState(
    AccountStore,
    (s) => s.balances['ousd'] || 0
  )
  const [displayedOusdBalance, setDisplayedOusdBalance] = useState(ousdBalance)

  return (
    <>
      <div className="flex-grow d-flex flex-column shadow-div">
        <BalanceHeader
          ousdBalance={ousdBalance}
          displayedOusdBalance={displayedOusdBalance}
          setDisplayedOusdBalance={setDisplayedOusdBalance}
        />
        <BuySellWidget displayedOusdBalance={displayedOusdBalance} />
      </div>
      <style jsx>{`
        div {
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          max-width: 716px;
          min-width: 630px;
        }

        .shadow-div {
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
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
