import React from 'react'
import classnames from 'classnames'

export default function PoolNameAndIcon({ pool, smallText, hideName = false }) {
  return (
    <div className="d-flex align-items-center">
      <img className="coin-icon one" src={`/images/${pool.coin_one.icon}`} />
      <img className="coin-icon two" src={`/images/${pool.coin_two.icon}`} />
      {!hideName && (
        <div className={classnames('name', { smallText })}>{pool.name}</div>
      )}
      <style jsx>{`
        .coin-icon {
          width: 30px;
          height: 30px;
          min-width: 30px;
          min-height: 30px;
          position: relative;
          z-index: 1;
        }

        .coin-icon.two {
          margin-left: -5px;
          z-index: 2;
        }

        .name {
          margin-left: 10px;
          font-family: Lato;
          font-size: 26px;
          color: #1e313f;
        }

        .name.smallText {
          font-size: 14px;
          color: #8293a4;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
