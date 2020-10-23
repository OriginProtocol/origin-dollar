import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'
import { formatCurrency } from 'utils/math'

export default function Pool({ pool }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showChinContents, setShowChinContents] = useState(false)

  useEffect(() => {
    // need to use timeout so animation works
    setTimeout(() => {
      if (pool.your_weekly_rate || pool.lp_tokens) {
        setIsOpen(true)
        setTimeout(() => {
          setShowChinContents(true)
        }, 700)
      } else {
        setIsOpen(false)
        setShowChinContents(false)
      }
    }, 10)
  }, [pool.your_weekly_rate, pool.lp_tokens])

  return (
    <>
      <div
        className={`chin-box d-flex flex-column flex-start ${
          isOpen ? 'open' : ''
        } ${pool.your_weekly_rate ? 'blue' : ''} ${
          pool.lp_tokens && !pool.your_weekly_rate ? 'grey' : ''
        }`}
      >
        <div className="pool d-flex flex-column flex-start">
          <div className="top d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <img
                className="coin-icon one"
                src={`/images/${pool.coin_one.icon}`}
              />
              <img
                className="coin-icon two"
                src={`/images/${pool.coin_two.icon}`}
              />
              <div className="name">{pool.name}</div>
              {pool.rewards_boost && (
                <div className="rewards-boost">
                  {fbt(
                    fbt.param('reward boost amount', pool.rewards_boost) +
                      'x rewards!',
                    'rewards boost label'
                  )}
                </div>
              )}
            </div>
            <div className="d-flex align-items-center">
              <a
                className="uniswap-link d-flex align-items-center"
                href={`https://uniswap.exchange/add/${pool.coin_one.contract_address}/${pool.coin_two.contract_address}`}
              >
                <img
                  className="uniswap-icon"
                  src="/images/uniswap-icon-grey.svg"
                />
                {fbt('Uniswap Pool', 'Uniswap Pool Link')}
              </a>
              <Link href={`/dapp/pool/${pool.name}`}>
                <a className="d-flex align-items-center justify-content-center pool-link">
                  <img className="caret-left" src="/images/caret-left.svg" />
                </a>
              </Link>
            </div>
          </div>
          <div className="bottom d-flex align-items-center justify-content-center">
            <div className="col-3 pl-0">
              <span className="light">{fbt('Current APY', 'Current APY')}</span>
              {formatCurrency(pool.current_apy * 100, 2)}%
            </div>
            <div className="col-5 column-2">
              <span className="light">
                {fbt('Pool deposits', 'Pool deposits')}
              </span>
              ${formatCurrency(parseFloat(pool.pool_deposits), 0)}
            </div>
            <div className="col-4 pr-0">
              <span className="light">{fbt('Pool rate', 'Pool rate')}</span>
              {formatCurrency(parseFloat(pool.pool_rate), 2)}
              <span className="small">{fbt('OGN/week', 'OGN/week')}</span>
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-center h-100">
          <div className={`${showChinContents ? 'visible' : ''} chin-contents`}>
            {pool.your_weekly_rate && (
              <>
                <span>{fbt('Your weekly rate', 'Your weekly rate')}</span>
                <img
                  className="ogn-icon"
                  src="/images/ogn-icon-white-border.svg"
                />
                <span className="emphasised">
                  {formatCurrency(pool.your_weekly_rate, 2)} OGN
                </span>
                <span className="small ml-1">{fbt('/ week', '/ week')}</span>
              </>
            )}
            {!pool.your_weekly_rate && pool.lp_tokens && (
              <>
                <span>
                  {fbt('Eligible LP Tokens', 'Eligible LP Tokens') + ' '}
                </span>
                <span className="emphasised ml-2">
                  {formatCurrency(pool.lp_tokens, 2)}
                </span>
                <span className="small ml-2">{` ${pool.coin_one.name}-${pool.coin_two.name}`}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        .chin-box {
          height: 160px;
          border-radius: 10px;
          margin-bottom: 20px;
          box-shadow: 0 0 14px 0 rgba(0, 0, 0, 0.1);
          transition: height 0.55s ease 0.2s;
          font-size: 18px;
        }

        .chin-box.open {
          height: 240px;
        }

        .chin-contents {
          opacity: 0;
          transition: opacity 0.5s ease 0s;
        }

        .chin-contents.visible {
          opacity: 1;
        }

        .chin-box.blue {
          color: white;
          background-color: #1a82ff;
          color: white;
        }

        .chin-box.grey {
          color: black;
          background-color: #cdd7e0;
          color: black;
        }

        .chin-box .ogn-icon {
          width: 20px;
          height: 20px;
          margin-left: 20px;
          margin-right: 10px;
        }

        .emphasised {
          font-weight: bold;
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
          margin-right: 16px;
        }

        .bottom .small {
          font-size: 14px;
          margin-left: 4px;
        }

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
          transition: transform 0.3s ease 0s;
        }

        .uniswap-link:hover .uniswap-icon {
          transform: rotate(-8deg);
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

        .pool-link:hover {
          background-color: #385160;
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
