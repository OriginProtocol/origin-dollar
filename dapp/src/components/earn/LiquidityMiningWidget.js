import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import { formatCurrency } from 'utils/math'
import StakeModal from 'components/earn/modal/StakeModal'

export default function LiquidityMiningWidget({ pool }) {
  const [showChinContents, setShowChinContents] = useState(false)
  const [displayChinContents, setDisplayChinContents] = useState(false)
  const [semiExtend, setSemiExtend] = useState(false)
  const [displayFooterContents, setDisplayFooterContents] = useState(false)
  const [
    displayFooterContentsBorder,
    setDisplayFooterContentsBorder,
  ] = useState(false)
  const [fullExtend, setFullExtend] = useState(false)

  // TODO: wire it up
  const { lpTokens } = useStoreState(AccountStore, (s) => s.balances)
  const stakedLpTokens = pool.stakedLpTokens

  const [showStakeModal, setShowStakeModal] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setSemiExtend(true)
      setTimeout(() => {
        setDisplayFooterContents(true)
        setTimeout(() => {
          setDisplayFooterContentsBorder(true)
        }, 200)
      }, 300)
    }, 500)

    setTimeout(() => {
      setFullExtend(true)
      setTimeout(() => {
        setDisplayChinContents(true)
        setTimeout(() => {
          setShowChinContents(true)
        }, 200)
      }, 300)
    }, 1000)
  }, [])

  return (
    <>
      {showStakeModal && <StakeModal
        pool={pool} 
        onClose={e =>{
          setShowStakeModal(false)
        }}
      />}
      <div
        className={`blue-chin d-flex flex-column ${
          semiExtend && !fullExtend ? 'semi-extended' : ''
        } ${fullExtend ? 'extended' : ''}`}
      >
        <div className="main-body d-flex flex-column justify-content-between">
          <div className="first-part d-flex">
            <div className="balance-box d-flex flex-column">
              <div className="title">
                {fbt('Available LP tokens', 'Available LP tokens')}
              </div>
              <div className="balance">{formatCurrency(12345.6789, 2)}</div>
            </div>
            <div className="balance-box d-flex flex-column">
              <div className="title">
                {fbt('Staked LP tokens', 'Staked LP tokens')}
              </div>
              <div className="balance">{formatCurrency(12345.6789, 2)}</div>
            </div>
            <div className="actions d-flex flex-column justify-content-start ml-auto">
              <button
                onClick={() => {
                  setShowStakeModal(true)
                }}
                className="btn-dark mw-191 mb-12"
              >
                {fbt('Stake', 'Stake')}
              </button>
              <button
                disabled
                onClick={() => {
                  showStakeModal(true)
                }}
                className="btn-dark mw-191"
              >
                {fbt('Unstake', 'Unstake')}
              </button>
            </div>
          </div>
          {semiExtend && (
            <div
              className={`main-body-footer flex-grow-1 d-flex align-items-center justify-content-center ${
                displayFooterContentsBorder ? 'boredered' : ''
              }`}
            >
              {displayFooterContents &&
                fbt(
                  'When you unstake, your OGN is claimed automatically',
                  'Unstake information message'
                )}
            </div>
          )}
        </div>
        {displayChinContents && (
          <div
            className={`chin-contents d-flex ${
              showChinContents ? 'visible' : ''
            }`}
          >
            <div className="balance-box d-flex flex-column">
              <div className="title">
                {fbt('Unclaimed OGN', 'Unclaimed OGN')}
              </div>
              <div className="balance">
                {formatCurrency(pool.claimable_ogn, 2)}
              </div>
            </div>
            <div className="weekly-rate d-flex align-items-center justify-content-center ml-auto">
              <img
                className="ogn-icon"
                src="/images/ogn-icon-white-border.svg"
              />
              {fbt(
                'Your rate: ' +
                  fbt.param('weekly-rate', pool.your_weekly_rate) +
                  ' OGN/week',
                "user's weekly rate"
              )}
            </div>
            <div className="actions d-flex flex-column justify-content-center">
              <button
                disabled
                onClick={() => {
                  console.log('CLAIM IT')
                }}
                className="btn-dark mw-191"
              >
                {fbt('Claim', 'Claim')}
              </button>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .blue-chin {
          width: 100%;
          height: 178px;
          border-radius: 10px;
          background-color: #1a82ff;
          transition: height 0.55s ease 0.2s;
        }

        .blue-chin.semi-extended {
          height: 218px;
        }

        .blue-chin.extended {
          height: 394px;
        }

        .chin-contents {
          opacity: 0;
          color: white;
          background-color: #1a82ff;
          transition: opacity 0.5s ease 0.3s;
          padding: 45px 50px;
          border-radius: 0px 0px 10px 10px;
        }

        .chin-contents.visible {
          opacity: 1;
        }

        .main-body {
          width: 100%;
          height: 100%;
          max-height: 218px;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: white;
          transition: height 0.55s ease 0.2s;
        }

        .first-part {
          height: 178px;
          padding: 45px 50px;
        }

        .balance-box {
          width: 300px;
        }

        .balance-box .title {
          font-size: 14px;
          font-weight: bold;
        }

        .balance-box .balance {
          font-size: 50px;
        }

        .first-part .balance-box .title {
          color: #8293a4;
        }

        .chin-contents .balance-box .title {
          color: #bbc9da;
        }

        .first-part .balance-box .balance {
          color: black;
        }

        .chin-contents .balance-box .balance {
          color: white;
        }

        .main-body-footer {
          width: 100%;
          border-radius: 0px 0px 10px 10px;
          background-color: #fafbfc;
          font-size: 14px;
          text-align: center;
          color: #8293a4;
          transition: border-top 0.55s ease 0s;
          height: 40px;
        }

        .main-body-footer.boredered {
          border-top: solid 1px #cdd7e0;
        }

        .mw-191 {
          min-width: 191px;
        }

        .mb-12 {
          margin-bottom: 12px;
        }

        .weekly-rate {
          margin-right: 58px;
          font-size: 14px;
          font-weight: normal;
        }

        .ogn-icon {
          width: 16px;
          height: 16px;
          margin-right: 10px;
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
