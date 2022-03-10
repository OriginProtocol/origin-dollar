import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import classnames from 'classnames'
import { useStoreState } from 'pullstate'
import withRpcProvider from 'hoc/withRpcProvider'

import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import { formatCurrency } from 'utils/math'
import StakeModal from 'components/earn/modal/StakeModal'
import ClaimModal from 'components/earn/modal/ClaimModal'
import UnstakeModal from 'components/earn/modal/UnstakeModal'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import { assetRootPath } from 'utils/image'

const LiquidityMiningWidget = ({ pool, rpcProvider }) => {
  const [showChinContents, setShowChinContents] = useState(false)
  const [displayChinContents, setDisplayChinContents] = useState(false)
  const [semiExtend, setSemiExtend] = useState(false)
  const [displayFooterContents, setDisplayFooterContents] = useState(false)
  const [displayFooterContentsBorder, setDisplayFooterContentsBorder] =
    useState(false)
  const [fullExtend, setFullExtend] = useState(false)
  const stakedLpTokens = pool.stakedLpTokens

  const [showStakeModal, setShowStakeModal] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [showFooter, setShowFooter] = useState(false)
  const [showUnstakeModal, setShowUnstakeModal] = useState(false)
  const [waitingForStakeTx, setWaitingForStakeTx] = useState(false)
  const [waitingForClaimTx, setWaitingForClaimTx] = useState(false)
  const [waitingForUnstakeTx, setWaitingForUnstakeTx] = useState(false)
  const isPastPool = pool.type === 'past'

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

  useEffect(() => {
    setShowFooter(Number(pool.staked_lp_tokens) > 0)
  }, [pool])

  return (
    <>
      {showStakeModal && (
        <StakeModal
          tokenAllowanceSuffiscient={
            Number(pool.lp_token_allowance) > Number.MAX_SAFE_INTEGER
          }
          tokenToStakeDecimalsCall={pool.lpContract.decimals}
          stakeFunctionCall={pool.contract.deposit}
          stakeTokenBalance={pool.lp_tokens}
          stakeTokenName={pool.name}
          contractApprovingTokenUsage={pool.lpContract}
          contractAllowedToMoveTokens={pool.contract}
          stakeButtonText={fbt('Deposit', 'Deposit')}
          selectTokensAmountTitle={fbt(
            'Deposit LP tokens',
            'Deposit LP tokens'
          )}
          approveTokensTitle={fbt('Approve & deposit', 'Approve & deposit')}
          availableToDepositSymbol=""
          tokenIconAndName={<PoolNameAndIcon smallText pool={pool} />}
          tokenIcon={<PoolNameAndIcon hideName={true} pool={pool} />}
          permissionToUseTokensText={fbt(
            'Permission to use ' + fbt.param('LP token name', pool.name),
            'Permission to use Liquidity Pool token'
          )}
          onClose={(e) => {
            setShowStakeModal(false)
          }}
          onUserConfirmedStakeTx={async (result, data) => {
            setWaitingForStakeTx(true)
            const receipt = await rpcProvider.waitForTransaction(result.hash)
            setWaitingForStakeTx(false)
          }}
          onError={(e) => {}}
        />
      )}
      {showClaimModal && (
        <ClaimModal
          onClose={(e) => {
            setShowClaimModal(false)
          }}
          onClaimContractCall={pool.contract.claim}
          ognToClaim={pool.claimable_ogn}
          onUserConfirmedClaimTx={async (result) => {
            setWaitingForClaimTx(true)
            const receipt = await rpcProvider.waitForTransaction(result.hash)
            setWaitingForClaimTx(false)
          }}
          infoText={fbt(
            'Your LP tokens will remain staked',
            'Your LP tokens will remain staked'
          )}
          onError={(e) => {}}
        />
      )}
      {showUnstakeModal && (
        <UnstakeModal
          pool={pool}
          onClose={(e) => {
            setShowUnstakeModal(false)
          }}
          onUserConfirmedStakeTx={async (result) => {
            setWaitingForUnstakeTx(true)
            const receipt = await rpcProvider.waitForTransaction(result.hash)
            setWaitingForUnstakeTx(false)
          }}
          onError={(e) => {}}
        />
      )}
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
              <div className="balance">{formatCurrency(pool.lp_tokens, 2)}</div>
            </div>
            <div className="balance-box d-flex flex-column">
              <div className="title">
                {fbt('Deposited LP tokens', 'Deposited LP tokens')}
              </div>
              <div className="balance">
                {formatCurrency(pool.staked_lp_tokens, 2)}
              </div>
            </div>
            <div className="actions d-flex flex-column justify-content-start ml-auto">
              <button
                disabled={Number(pool.lp_tokens) === 0 || isPastPool}
                onClick={() => {
                  setShowStakeModal(true)
                }}
                className="btn-dark mw-191 mb-12"
              >
                {!waitingForStakeTx && fbt('Deposit', 'Deposit')}
                {waitingForStakeTx && (
                  <SpinningLoadingCircle backgroundColor="183140" />
                )}
              </button>
              <button
                disabled={Number(pool.staked_lp_tokens) === 0}
                onClick={() => {
                  setShowUnstakeModal(true)
                }}
                className="btn-dark mw-191"
              >
                {!waitingForUnstakeTx && fbt('Withdraw', 'Withdraw')}
                {waitingForUnstakeTx && (
                  <SpinningLoadingCircle backgroundColor="183140" />
                )}
              </button>
            </div>
          </div>
          {semiExtend && (
            <div
              className={`main-body-footer flex-grow-1 d-flex align-items-center justify-content-center ${
                displayFooterContentsBorder && showFooter ? 'boredered' : ''
              }`}
            >
              {displayFooterContents &&
                showFooter &&
                fbt(
                  'When you withdraw, your OGN is claimed automatically',
                  'Withdraw information message'
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
                src={assetRootPath('/images/ogn-icon-clear-blue-white-rim.svg')}
              />
              {fbt(
                'Your rate: ' +
                  fbt.param(
                    'weekly-rate',
                    formatCurrency(pool.your_weekly_rate, 2)
                  ) +
                  ' OGN/week',
                "user's weekly rate"
              )}
            </div>
            <div className="actions d-flex flex-column justify-content-center">
              <button
                disabled={Number(pool.claimable_ogn) === 0}
                onClick={() => {
                  setShowClaimModal(true)
                }}
                className="btn-dark mw-191"
              >
                {!waitingForClaimTx && fbt('Claim', 'Claim')}
                {waitingForClaimTx && (
                  <SpinningLoadingCircle backgroundColor="183140" />
                )}
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
          font-size: 14px;
          text-align: center;
          color: #8293a4;
          transition: border-top 0.55s ease 0s;
          transition: background-color 0.55s ease 0s;
          height: 40px;
        }

        .main-body-footer.boredered {
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
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

export default withRpcProvider(LiquidityMiningWidget)
