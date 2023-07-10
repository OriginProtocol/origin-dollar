import React from 'react'

import SwapHomepage from 'components/buySell/SwapHomepage'

const MissionControl = ({}) => {
  return (
    <>
      <div className="w-100 swap-contain">
        <SwapHomepage />
      </div>
      <style jsx>{`
        .swap-contain {
          margin-top: 18px;
        }

        @media (max-width: 767px) {
          .swap-contain {
            padding: 0 12px;
          }
        }
      `}</style>
    </>
  )
}

export default MissionControl
