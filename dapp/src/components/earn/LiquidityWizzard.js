import React from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'

export default function LiquidityWizzard({ pool }) {

  return (
    <>
      <div className="header">
        {fbt('My liquidity', 'My liquidity')}
        <span className="small">{fbt('LP Token: ' + fbt.param('token name', pool.name.replace('/', '-')), 'LP Token')}</span>
      </div>
      <style jsx>{`
        .header {
          font-size: 18px;
          font-weight: bold;
          color: #8293a4;
        }

        .header .small {
          font-size: 14px;
          margin-left: 17px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}