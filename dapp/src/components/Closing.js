import React from 'react'

import GetOUSD from './GetOUSD'

export default function Closing() {
  return (
    <div className="closing">
      <h5>Start earning with OUSD today</h5>
      <GetOUSD className="mx-auto" style={{ marginTop: 40 }} dark />
      <style jsx>{`
        h5 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 0.86;
        }
      `}</style>
    </div>
  )
}
