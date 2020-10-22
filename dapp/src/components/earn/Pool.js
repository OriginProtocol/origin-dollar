import React from 'react'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'

export default function Pool({ pool }) {
  return (
    <>
      <div className="chin-box d-flex flex-column flex-start">
        <div className="pool d-flex flex-column flex-start">
          <div className="top d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <img className="coin-icon one" src={`/images/${pool.coin_one.icon}`}/>
              <img className="coin-icon two" src={`/images/${pool.coin_two.icon}`}/>
              <div className="name">{pool.name}</div>
              {pool.rewards_boost && <div
                className="rewards-boost"
              >
                {fbt( fbt.param('reward boost amount', pool.rewards_boost) + 'x rewards!', 'rewards boost label')}
              </div>}
            </div>
            <div className="d-flex align-items-center">
              <a 
                className="uniswap-link d-flex align-items-center"
                href={`https://uniswap.exchange/add/${pool.coin_one.contract_address}/${pool.coin_two.contract_address}`}
              >
                <img className="uniswap-icon" src="/images/uniswap-icon-grey.svg"/>
                {fbt('Uniswap Pool', 'Uniswap Pool Link')}
              </a>
              <Link href={`/dapp/pool/${pool.name}`}>
                <a className="d-flex align-items-center justify-content-center pool-link">
                  <img className="caret-left" src="/images/caret-left.svg"/>
                </a>
              </Link>
            </div>
          </div>
          <div className="bottom d-flex align-items-center justify-content-center">
            <div className="col-3 pl-0">
              <span className="light">{fbt('Current APY', 'Current APY')}</span>

            </div>
            <div className="col-5 column-2">213213</div>
            <div className="col-4">231132</div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .chin-box {
          height: 160px;
          border-radius: 10px;
          margin-bottom: 20px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
        }

        .chin-box.open {
          height: 240px;
          border: solid 1px #cdd7e0;
        }

        .chin-box.blue{
          color: white;
          background-color: #1a82ff;
        }

        .chin-box.blue{
          color: black;
          background-color: #cdd7e0;
        }
        
        .pool {
          height: 160px;
          border-radius: 10px;
          background-color: white;
          border: solid 1px #cdd7e0;
        }

        .top {
          border-radius: 10px 10px 0px 0px;
          border-bottom: solid 1px #cdd7e0;
          padding: 0px 25px 0px 25px;
          height: 80px;
        }

        .bottom {
          border-radius: 0px 0px 10px 10px;
          padding: 0px 30px 0px 30px;
          height: 80px;
          font-size: 20px;
          color: #1e313f;
        }

        .bottom .light {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
        }

        .coin-icon {
          width: 30px;
          height: 30px;
          position: relative;
          z-index:1;
        }

        .coin-icon.two {
          margin-left: -5px;
          z-index:2;
        }

        .name {
          margin-left: 10px;
          font-family: Lato;
          font-size: 26px;
          color: #1e313f;
        }

        .uniswap-link {
          font-family: Lato;
          font-size: 14px;
          color: #8293a4;
        }

        .uniswap-icon {
          width: 17px;
          height: 20px;
          margin-right: 9px;
        }

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

        .pool-link {
          width: 40px;
          height: 40px;
          background-color: #183140;
          font-family: material;
          font-size: 22px;
          color: #fafbfc;
          border-radius: 25px;
          margin-left: 50px;
        }

        .caret-left {
          transform: rotate(180deg);
          width: 7px;
          height: 14px;
        }

        .column-2 {
          padding-left: 2.5rem;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
