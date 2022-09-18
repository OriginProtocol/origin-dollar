import React from 'react'
import Pool from 'components/earn/Pool'

export default function PoolsList({ title, pools, titleStyle }) {
  if (pools.length === 0) {
    return null
  }

  return (
    <div className="d-flex flex-column w-100">
      {title && (
        <div className={`title ${titleStyle ? titleStyle : ''}`}>{title}</div>
      )}
      {pools.map((pool) => (
        <Pool pool={pool} key={pool.name} />
      ))}
      <style jsx>{`
        .title {
          margin-top: 30px;
          margin-bottom: 20px;
          font-size: 14px;
          font-weight: bold;
          color: #1e313f;
        }

        .title.white {
          color: white;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </div>
  )
}
