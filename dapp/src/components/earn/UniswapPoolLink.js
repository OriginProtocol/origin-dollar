import React from 'react'
import { fbt } from 'fbt-runtime'

export default function UniswapPoolLink({ pool }) {
  return (
    <>
      <a
        className="uniswap-link d-flex align-items-center"
        target="_blank"
        rel="noopener noreferrer"
        href={`https://uniswap.exchange/add/${pool.coin_one.contract_address}/${pool.coin_two.contract_address}`}
      >
        <img className="uniswap-icon" src="/images/uniswap-icon-grey.svg" />
        {fbt('Uniswap pool', 'Uniswap pool link')}
      </a>
      <style jsx>{`
        .uniswap-link {
          font-family: Lato;
          font-size: 14px;
          color: #8293a4;
          padding-bottom: 3px;
        }

        .uniswap-link:hover {
          border-bottom: 1px solid #8293a4;
          padding-bottom: 2px;
        }

        .uniswap-icon {
          width: 17px;
          height: 20px;
          margin-right: 9px;
          margin-bottom: 2px;
          transition: transform 0.3s ease 0s;
        }

        .uniswap-link:hover .uniswap-icon {
          transform: rotate(-8deg);
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
