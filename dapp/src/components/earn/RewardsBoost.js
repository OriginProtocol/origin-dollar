import React from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'

export default function RewardsBoost({ pool, ml50 }) {
  return (
    <>
      <div className="d-flex align-items-center justify-content-center">
        <div className={classnames('rewards-boost', { ml50 })}>
          {fbt(
            fbt.param('reward boost amount', pool.rewards_boost) + 'x rewards!',
            'rewards boost label'
          )}
        </div>
      </div>
      <style jsx>{`
        .rewards-boost {
          background-color: #fec100;
          font-family: Lato;
          font-size: 14px;
          font-weight: bold;
          color: #183140;
          padding: 5px 12px;
          border-radius: 5px;
          margin-left: 32px;
        }

        .rewards-boost.ml50 {
          margin-left: 50px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
