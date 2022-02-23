import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'
import { formatCurrency } from 'utils/math'
import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import UniswapPoolLink from 'components/earn/UniswapPoolLink'
import RewardsBoost from 'components/earn/RewardsBoost'
import { assetRootPath } from 'utils/image'
import { adjustLinkHref } from 'utils/utils'

export default function Pool({ pool }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showChinContents, setShowChinContents] = useState(false)
  const lpTokensNumber = Number(pool.lp_tokens)

  useEffect(() => {
    // need to use timeout so animation works
    setTimeout(() => {
      if (pool.your_weekly_rate || lpTokensNumber) {
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
          pool.style ? `${pool.style}-sytle` : ''
        } ${isOpen ? 'open' : ''} ${pool.your_weekly_rate ? 'blue' : ''} ${
          lpTokensNumber && !pool.your_weekly_rate ? 'grey' : ''
        }`}
      >
        <div className="pool d-flex flex-column flex-start">
          <div className="top d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <PoolNameAndIcon isPoolDetails={true} pool={pool} />
              {pool.rewards_boost && <RewardsBoost pool={pool} />}
            </div>
            <div className="d-flex align-items-center">
              <UniswapPoolLink isPoolDetails={true} pool={pool} />
              <Link
                href={adjustLinkHref(`/pool/${encodeURIComponent(pool.name)}`)}
              >
                <a className="d-flex align-items-center justify-content-center pool-link">
                  <img
                    className="caret-left"
                    src={assetRootPath('/images/caret-left.svg')}
                  />
                </a>
              </Link>
            </div>
          </div>
          <div className="bottom d-flex align-items-center justify-content-center">
            <div className="col-3 pl-0">
              <span className="light">
                {fbt('Approximate APY', 'Approximate APY')}
              </span>
              {formatCurrency(pool.current_apy * 100, 2)}%
            </div>
            <div className="col-5 column-2">
              <span className="light">
                {fbt('LP token deposits', 'LP token deposits')}
              </span>
              ${formatCurrency(parseFloat(pool.pool_deposits), 0)}
            </div>
            <div className="col-4 pr-0">
              <span className="light">{fbt('Pool rate', 'Pool rate')}</span>
              {formatCurrency(parseFloat(pool.pool_rate), 0)}
              <span className="small">{fbt('OGN/week', 'OGN/week')}</span>
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-center h-100">
          <div
            className={`${
              showChinContents ? 'visible' : ''
            } chin-contents align-items-center justify-content-center`}
          >
            {pool.your_weekly_rate > 0 && (
              <>
                <span>{fbt('Your weekly rate', 'Your weekly rate')}</span>
                <img
                  className="ogn-icon"
                  src={assetRootPath(
                    '/images/ogn-icon-clear-blue-white-rim.svg'
                  )}
                />
                <span className="emphasised">
                  {formatCurrency(pool.your_weekly_rate, 2)} OGN
                </span>
                <span className="small ml-1">{fbt('/ week', '/ week')}</span>
              </>
            )}
            {pool.your_weekly_rate === 0 && lpTokensNumber > 0 && (
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

        .chin-box.green-sytle .pool {
          border-color: #358971;
          background-color: transparent;
        }

        .chin-box.orange-sytle .pool {
          border-color: #cc9b00;
          background-color: transparent;
        }

        .chin-box.blue-sytle .pool {
          border-color: #10529a;
          background-color: transparent;
        }

        .top {
          border-radius: 10px 10px 0px 0px;
          border-bottom: solid 1px #cdd7e0;
          padding: 0px 25px 0px 25px;
          height: 80px;
        }

        .chin-box.green-sytle .top {
          background-color: #53ae94;
          border-bottom: solid 1px #358971;
        }

        .chin-box.orange-sytle .top {
          background-color: #febe44;
          border-bottom: solid 1px #cc9b00;
        }

        .chin-box.blue-sytle .top {
          background-color: #2775ca;
          border-bottom: solid 1px #10529a;
        }

        .chin-box.orange-sytle .bottom,
        .chin-box.green-sytle .bottom,
        .chin-box.blue-sytle .bottom {
          color: white;
        }

        .bottom {
          border-radius: 0px 0px 10px 10px;
          padding: 0px 30px 0px 30px;
          height: 80px;
          font-size: 20px;
          color: #1e313f;
        }

        .chin-box.green-sytle .bottom {
          background-color: #479e85;
        }

        .chin-box.orange-sytle .bottom {
          background-color: #f1af33;
        }

        .chin-box.blue-sytle .bottom {
          background-color: #1c66b7;
        }

        .bottom .light {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
          margin-right: 16px;
        }

        .chin-box.orange-sytle .bottom .light,
        .chin-box.green-sytle .bottom .light,
        .chin-box.blue-sytle .bottom .light {
          color: white;
          opacity: 0.7;
        }

        .bottom .small {
          font-size: 14px;
          margin-left: 4px;
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
