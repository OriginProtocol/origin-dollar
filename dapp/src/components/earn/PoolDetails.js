import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { formatCurrency } from 'utils/math'
import { useWeb3React } from '@web3-react/core'

import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import UniswapPoolLink from 'components/earn/UniswapPoolLink'
import RewardsBoost from 'components/earn/RewardsBoost'
import LiquidityWizzard from 'components/earn/LiquidityWizzard'
import LiquidityMiningWidget from 'components/earn/LiquidityMiningWidget'
import StakeModal from 'components/earn/modal/StakeModal'

export default function PoolDetails({ pool }) {
  const { account } = useWeb3React()
  const [showWizzard, setShowWizzard] = useState(false)
  const [poolRateIsOgn, setPoolRateIsOgn] = useState(true)
  const [poolDepositIsDollar, setPoolDepositIsDollar] = useState(true)
  const wizzardKey = `${account}-${pool.name}-hide-wizzard`

  const hideWizzard = () => {
    setShowWizzard(false)
    localStorage.setItem(wizzardKey, 'true')
  }

  useEffect(() => {
    setShowWizzard(localStorage.getItem(wizzardKey) !== 'true')
  }, [account])

  return (
    <>
      <StakeModal pool={pool} />
      <div className="d-flex header-info">
        <PoolNameAndIcon pool={pool} />
        <div className="ml-auto d-flex">
          <UniswapPoolLink pool={pool} />
          {pool.rewards_boost && <RewardsBoost ml50 pool={pool} />}
        </div>
      </div>
      <div className="d-flex flex-column flex-md-row header-info">
        <div className="pill ml-md-0">
          <div className="header">{fbt('Current APY', 'Current APY')}</div>
          <div className="value">
            {formatCurrency(pool.current_apy * 100, 2)}%
          </div>
          <div className="top-right-action">
            <img src="/images/balance-toggle.svg" />
          </div>
        </div>
        <div className="pill">
          <div className="header">{fbt('Poll deposits', 'Poll deposits')}</div>
          <div className="value">
            ${formatCurrency(parseFloat(pool.pool_deposits), 0)}
          </div>
          <div
            className="top-right-action"
            onClick={() => {
              setPoolDepositIsDollar(!poolDepositIsDollar)
            }}
          >
            <img src="/images/balance-toggle.svg" />
          </div>
        </div>
        <div className="pill mr-md-0">
          <div className="header">
            {fbt('Pool rate (OGN/week)', 'Pool rate')}
          </div>
          <div className="value">
            {formatCurrency(parseFloat(pool.pool_rate), 0)}
          </div>
          <div
            className="top-right-action"
            onClick={() => {
              setPoolRateIsOgn(!poolRateIsOgn)
            }}
          >
            <img
              src={`/images/${poolRateIsOgn ? 'ogn-toggle' : 'usd-toggle'}.svg`}
            />
          </div>
        </div>
      </div>
      <div className="pool-header">
        {fbt('My liquidity', 'My liquidity')}
        <span className="small">
          {fbt(
            'LP Token: ' + fbt.param('token name', pool.name.replace('/', '-')),
            'LP Token'
          )}
        </span>
      </div>
      {showWizzard && (
        <LiquidityWizzard pool={pool} onHideWizzard={hideWizzard} />
      )}

      {!showWizzard && <LiquidityMiningWidget pool={pool} />}
      <style jsx>{`
        .header-info {
          padding-bottom: 35px;
        }

        .pill {
          display: flex;
          align-items: flex-start;
          flex-direction: column;
          justify-content: center;
          position: relative;
          height: 108px;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          padding: 30px 24px;
          margin: 0px 1%;
          flex: 0 0 32%;
          max-width: 32%;
        }

        .pill .header {
          font-size: 14px;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: 8px;
        }

        .pill .value {
          font-size: 28px;
          color: #1e313f;
        }

        .top-right-action {
          position: absolute;
          top: 5px;
          right: 11px;
          cursor: pointer;
        }

        .pool-header {
          font-size: 18px;
          font-weight: bold;
          color: #8293a4;
          margin-bottom: 17px;
        }

        .pool-header .small {
          font-size: 14px;
          margin-left: 17px;
        }

        @media (max-width: 992px) {
          .pill {
            margin: 10px 0px;
            flex: 0 0 100%;
            max-width: 100%;
          }
        }
      `}</style>
    </>
  )
}
