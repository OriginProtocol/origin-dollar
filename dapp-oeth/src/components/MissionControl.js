import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'

import SwapHomepage from 'components/buySell/SwapHomepage'

const MissionControl = ({}) => {
  return (
    <>
      <div className="w-100 swap-contain">
        <SwapHomepage />
      </div>
      <style jsx>{`
        @media (max-width: 767px) {
          .swap-contain {
            padding: 0 20px;
          }
        }
      `}</style>
    </>
  )
}

export default MissionControl
