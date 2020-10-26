import React from 'react'

export default function PoolNameAndIcon({ pool }) {

  return (
    <>
    	<img
        className="coin-icon one"
        src={`/images/${pool.coin_one.icon}`}
      />
      <img
        className="coin-icon two"
        src={`/images/${pool.coin_two.icon}`}
      />
      <div className="name">{pool.name}</div>
      <style jsx>{`
      	.coin-icon {
          width: 30px;
          height: 30px;
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
        
        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}