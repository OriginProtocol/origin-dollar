import React from 'react'

import GetOUSD from './GetOUSD'

export default function Closing(props) {
  return (
    <div className="closing">
      <h5>Start earning with OUSD in just a few minutes</h5>
      <GetOUSD className="mx-auto" style={{ marginTop: 40 }} {...props} />
      <style jsx>{`
        h5 {
          font-family: Poppins;
          font-size: 1.75rem;
          font-weight: 500;
          line-height: 0.86;
        }

        @media (max-width: 992px) {
          h5 {
            line-height: 1.33;
          }
        }
      `}</style>
    </div>
  )
}
