import React, { useEffect, useState } from 'react'
import { fbt } from 'fbt-runtime'
import { formatCurrency } from 'utils/math'
import { useWeb3React } from '@web3-react/core'

import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import UniswapPoolLink from 'components/earn/UniswapPoolLink'
import Link from 'next/link'
import RewardsBoost from 'components/earn/RewardsBoost'
import LiquidityWizard from 'components/earn/LiquidityWizard'
import LiquidityMiningWidget from 'components/earn/LiquidityMiningWidget'
import ApyModal from 'components/earn/modal/ApyModal'
import GetOUSD from 'components/GetOUSD'
import { assetRootPath } from 'utils/image'
import { adjustLinkHref } from 'utils/utils'

export default function PoolDetails({ pool }) {
  const { account, active } = useWeb3React()
  const [showWizzard, setShowWizzard] = useState(false)
  const [poolRateIsOgn, setPoolRateIsOgn] = useState(true)
  const [poolDepositIsDollar, setPoolDepositIsDollar] = useState(true)
  const [apyModalOpened, setApyModalOpened] = useState(false)
  const wizzardKey = `${account}-${pool.name}-hide-wizzard`
  const ognPrice = 0.118764
  const lgTokenPrice = 0.268764

  const hideWizzard = () => {
    setShowWizzard(false)
    localStorage.setItem(wizzardKey, 'true')
  }

  useEffect(() => {
    setShowWizzard(localStorage.getItem(wizzardKey) !== 'true')
  }, [account])

  return (
    <>
      {apyModalOpened && (
        <ApyModal
          pool={pool}
          onClose={(e) => {
            setApyModalOpened(false)
          }}
        />
      )}
      <div className="d-flex header-info">
        <Link href={adjustLinkHref('/earn')}>
          <div className="breadcrum">&lt; {fbt('All pools', 'All pools')}</div>
        </Link>
        <PoolNameAndIcon pool={pool} />
        <div className="ml-auto d-flex">
          <UniswapPoolLink pool={pool} />
          {pool.rewards_boost && <RewardsBoost ml50 pool={pool} />}
        </div>
      </div>
      <div className="d-flex flex-column flex-md-row header-info">
        <div className="pill ml-md-0">
          <div className="header">
            {fbt('Approximate APY', 'Approximate APY')}
          </div>
          <div className="value">
            {formatCurrency(pool.current_apy * 100, 2)}%
          </div>
          <div
            className="top-right-action"
            onClick={(e) => {
              setApyModalOpened(true)
            }}
          >
            <img src={assetRootPath('/images/more-icon-off.svg')} />
          </div>
        </div>
        <div className="pill">
          <div className="header">
            {fbt('LP token deposits', 'LP token deposits')}
          </div>
          <div className="value">
            {poolDepositIsDollar &&
              '$' + formatCurrency(parseFloat(pool.pool_deposits), 0)}
            {!poolDepositIsDollar &&
              formatCurrency(parseFloat(pool.pool_deposits) / lgTokenPrice, 0)}
          </div>
          <div
            className="top-right-action"
            onClick={() => {
              setPoolDepositIsDollar(!poolDepositIsDollar)
            }}
          >
            <img
              src={assetRootPath(
                `/images/${
                  poolDepositIsDollar ? 'usd-toggle.svg' : 'tokens-toggle.svg'
                }`
              )}
            />
          </div>
        </div>
        <div className="pill mr-md-0">
          <div className="header">
            {fbt('Pool rate (per week)', 'Pool rate (per week)')}
          </div>
          <div className="value">
            {poolRateIsOgn && formatCurrency(parseFloat(pool.pool_rate), 0)}
            {!poolRateIsOgn &&
              '$' + formatCurrency(parseFloat(pool.pool_rate * ognPrice), 0)}
          </div>
          <div
            className="top-right-action"
            onClick={() => {
              setPoolRateIsOgn(!poolRateIsOgn)
            }}
          >
            <img
              src={assetRootPath(
                `/images/${poolRateIsOgn ? 'ogn-toggle' : 'usd-toggle'}.svg`
              )}
            />
          </div>
        </div>
      </div>
      <div className="pool-header">
        {fbt('Your position', 'Your position')}
        <span className="small">
          {fbt(
            'LP token: ' + fbt.param('token name', pool.name.replace('/', '-')),
            'LP token'
          )}
        </span>
      </div>
      {showWizzard && active && (
        <LiquidityWizard pool={pool} onHideWizzard={hideWizzard} />
      )}
      {!showWizzard && active && <LiquidityMiningWidget pool={pool} />}
      {!active && (
        <div className="disconnected d-flex flex-column align-items-center justify-content-center">
          <img src={assetRootPath('/images/wallet-icon.svg')} />
          <div className="header-disconnect">
            {fbt(
              'Start by connecting your wallet',
              'Connect wallet pool details screen'
            )}
          </div>
          <GetOUSD primary connect />
        </div>
      )}
      <style jsx>{`
        .header-info {
          padding-bottom: 35px;
          position: relative;
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
          opacity: 0.75;
        }

        .top-right-action:hover {
          opacity: 1;
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

        .disconnected {
          min-height: 358px;
          padding: 65px;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: white;
        }

        .header-disconnect {
          font-size: 28px;
          text-align: center;
          color: #183140;
          margin: 31px 0 32px 0;
        }

        .breadcrum {
          position: absolute;
          font-size: 14px;
          top: -30px;
          color: #8293a4;
          cursor: pointer;
        }

        .breadcrum:hover {
          border-bottom: 1px solid #8293a4;
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
