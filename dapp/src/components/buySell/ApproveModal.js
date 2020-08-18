import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'

const ApproveModal = ({ balances }) => {
  const ousdBalance = useStoreState(AccountStore, s => s.balances['ousd'] || 0)

  return <>
    <div>
    </div>
    <style jsx>{`
      
    `}</style>
  </>
}

export default ApproveModal
  