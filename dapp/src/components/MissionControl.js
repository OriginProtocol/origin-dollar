import React, { useState } from 'react'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import BalanceHeader from 'components/BalanceHeader'
import BuySellWidget from 'components/BuySellWidget'

const MissionControl = ({}) => {
  const allowances = useStoreState(AccountStore, s => s.allowances)
  const balances = useStoreState(AccountStore, s => s.balances)
  const account = useStoreState(AccountStore, s => s.address)

  return (
    <>
      <div className="shadowed-box">
        <BalanceHeader
          balances={balances}
        />
        <BuySellWidget />
      </div>
      <style jsx>{`
        .shadowed-box {
          min-width: 630px;
        }
      `}</style>
    </>
  )
}

export default MissionControl

require('react-styl')(`
  .shadowed-box
    min-width: 630px
`)
