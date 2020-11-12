import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import ethers from 'ethers'

import withRpcProvider from 'hoc/withRpcProvider'
import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import { useStoreState } from 'pullstate'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'

const StakeModal = ({
  pool,
  onClose,
  onUserConfirmedStakeTx,
  onError,
  rpcProvider,
}) => {
  /* select-tokens -> where user select amount of tokens to stake
   * approve-lp -> where user approves LP token allowance for the contract
   * approve-user-wait -> waiting for the user to approve tokens
   * approve-network-wait -> waiting for the network to mine the tx
   * approve-done -> tokens approved
   * [approve-finalise/select]-user-wait -> waiting for user to finalise transaction
   */
  const [modalState, setModalState] = useState('select-tokens')
  const [lpTokensToStake, setLpTokensToStake] = useState(0)
  const [displayedLpTokensToStake, setDisplayedLpTokensToStake] = useState(0)
  const lpTokenAllowanceApproved =
    Number(pool.lp_token_allowance) > Number.MAX_SAFE_INTEGER
  const [selectTokensError, setSelectTokensError] = useState(null)
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)

  const getActions = () => {
    if (modalState === 'select-tokens') {
      return [
        {
          text: fbt('Stake', 'Stake'),
          isDisabled: !!selectTokensError,
          onClick: async () => {
            if (lpTokenAllowanceApproved) {
              setModalState('select-user-wait')
              const stakeAmount = ethers.utils.parseUnits(
                lpTokensToStake.toString(),
                await pool.lpContract.decimals()
              )
              const result = await pool.contract.deposit(stakeAmount)
              onUserConfirmedStakeTx(result)
              onClose()
            } else {
              setModalState('approve-lp')
            }
          },
        },
      ]
    } else if (
      ['approve-lp', 'approve-user-wait', 'approve-network-wait'].includes(
        modalState
      )
    ) {
      return [
        {
          text: fbt('Stake', 'Stake'),
          isDisabled: true,
          onClick: () => {},
        },
      ]
    } else if (['approve-done'].includes(modalState)) {
      return [
        {
          text: fbt('Stake', 'Stake'),
          isDisabled: false,
          onClick: async () => {
            try {
              setModalState('approve-finalise-user-wait')
              const stakeAmount = ethers.utils.parseUnits(
                lpTokensToStake.toString(),
                await pool.lpContract.decimals()
              )
              const result = await pool.contract.deposit(stakeAmount)
              onUserConfirmedStakeTx(result)
              onClose()
            } catch (e) {
              // TODO handle error
              console.log(
                'ERROR occurred when waiting to confirm transaction ',
                e
              )
            }
          },
        },
      ]
    }
  }

  const getTitle = () => {
    if (modalState.startsWith('select')) {
      return fbt('Stake LP Tokens', 'Stake LP Tokens')
    } else {
      return fbt(
        'Approve & finalize transaction',
        'Approve & finalize transaction'
      )
    }
  }

  const setLPTokensInputValue = (value) => {
    const notNullValue = parseFloat(value) < 0 ? '0' : value || '0'
    const valueNoCommas = notNullValue.replace(/,/g, '')
    setLpTokensToStake(valueNoCommas)
    setDisplayedLpTokensToStake(value)
    validateTokensToStake(valueNoCommas)
  }

  const validateTokensToStake = (lpTokensToStake) => {
    if (parseFloat(pool.lp_tokens) < lpTokensToStake) {
      setSelectTokensError(
        fbt('Insufficient balance of tokens', 'not enough tokens error')
      )
    } else {
      setSelectTokensError(null)
    }
  }

  const closeable = () => {
    return ['select-tokens', 'approve-lp', 'approve-done'].includes(modalState)
  }

  return (
    <>
      <EarnModal
        closeable={closeable()}
        onClose={onClose}
        bodyContents={
          <>
            {['select-tokens', 'select-user-wait'].includes(modalState) && (
              <>
                <div className="d-flex flex-column align-items-center">
                  <div className="small-blue-text center-top">
                    {fbt(
                      'Available to stake: ' +
                        fbt.param(
                          'lp-tokens',
                          formatCurrency(pool.lp_tokens, 2)
                        ),
                      'Available LP tokens'
                    )}
                  </div>
                  <div
                    className={`input-wrapper d-flex ${
                      selectTokensError ? 'error' : ''
                    }`}
                  >
                    <div className="input-holder d-flex">
                      <input
                        type="float"
                        placeholder="0.00"
                        value={displayedLpTokensToStake}
                        onChange={(e) => {
                          const lpTokens = e.target.value
                          setLPTokensInputValue(lpTokens)
                        }}
                        onBlur={(e) => {
                          setDisplayedLpTokensToStake(
                            lpTokensToStake !== 0
                              ? formatCurrency(lpTokensToStake, 6)
                              : ''
                          )
                        }}
                        onFocus={(e) => {
                          if (!lpTokensToStake) {
                            setDisplayedLpTokensToStake('')
                          }
                        }}
                      />
                      <button
                        className="max-button"
                        onClick={(e) => {
                          setLPTokensInputValue(
                            formatCurrency(pool.lp_tokens, 6)
                          )
                        }}
                      >
                        {fbt('Max', 'Max LP tokens')}
                      </button>
                    </div>
                    <div className="token-info d-flex">
                      <PoolNameAndIcon smallText pool={pool} />
                    </div>
                  </div>
                  {selectTokensError && (
                    <div className="error-box">{selectTokensError}</div>
                  )}
                </div>
              </>
            )}
            {modalState === 'approve-lp' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                <PoolNameAndIcon hideName={true} pool={pool} />
                <div className="emphasis">
                  {fbt(
                    'Permission to use ' +
                      fbt.param('LP token name', pool.name),
                    'Permission to use Liquidity Pool token'
                  )}
                </div>
                <button
                  className="btn-dark inner mb-22"
                  onClick={async (e) => {
                    try {
                      setModalState('approve-user-wait')
                      const result = await pool.lpContract.approve(
                        pool.contract.address,
                        ethers.constants.MaxUint256
                      )

                      setModalState('approve-network-wait')
                      const receipt = await rpcProvider.waitForTransaction(
                        result.hash
                      )
                      const isError =
                        typeof receipt.status === 'number' &&
                        receipt.status === 0

                      if (!isError) {
                        setModalState('approve-done')
                      } else {
                        setModalState('approve-lp')
                      }
                    } catch (e) {
                      // TODO display there was an error
                      console.log(
                        'ERROR occurred when waiting to confirm transaction ',
                        e
                      )
                      setModalState('approve-lp')
                    }
                  }}
                >
                  {fbt('Approve', 'Approve')}
                </button>
              </div>
            )}
            {modalState === 'approve-user-wait' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                <PoolNameAndIcon hideName={true} pool={pool} />
                <div className="emphasis mb-16">
                  {fbt(
                    'Waiting for you to approve…',
                    'Waiting for you to approve…'
                  )}
                </div>
                <div className="grey-icon-holder d-flex align-items-center justify-content-center mb-22">
                  <img src={`/images/${connectorIcon}`} />
                </div>
              </div>
            )}
            {modalState === 'approve-network-wait' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                <PoolNameAndIcon hideName={true} pool={pool} />
                <div className="emphasis mb-16">
                  {fbt(
                    'Approving ' +
                      fbt.param('LP token name', pool.name) +
                      '...',
                    'Approving the use of Liquidity Pool token'
                  )}
                </div>
                <div className="grey-icon-holder d-flex align-items-center justify-content-center mb-22">
                  <SpinningLoadingCircle />
                </div>
              </div>
            )}
            {['approve-finalise-user-wait', 'approve-done'].includes(
              modalState
            ) && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                <PoolNameAndIcon hideName={true} pool={pool} />
                <div className="emphasis mb-16">
                  {fbt(
                    fbt.param('LP token name', pool.name.toUpperCase()) +
                      ' approved',
                    'Liquidity Pool token approved'
                  )}
                </div>
                <img
                  className="mb-22 green-check"
                  src="/images/green-check.svg"
                />
              </div>
            )}
          </>
        }
        title={getTitle()}
        actions={getActions()}
        actionsBody={
          <>
            {['approve-finalise-user-wait', 'select-user-wait'].includes(
              modalState
            ) && (
              <div className="d-flex align-items-center justify-content-center">
                <img
                  className="big-connector-icon"
                  src={`/images/${connectorIcon}`}
                />
                <div className="action-text">
                  {fbt(
                    'Please finalize your transaction…',
                    'Finalize your transaction'
                  )}
                </div>
              </div>
            )}
          </>
        }
      />
      <style jsx>{`
        .small-blue-text {
          font-size: 14px;
          text-align: center;
          color: #8293a4;
        }

        .center-top {
          margin-top: 8px;
          margin-bottom: 20px;
        }

        .max-button {
          border: 0px;
          background-color: transparent;
          font-size: 14px;
          text-align: center;
          color: #1a82ff;
          padding: 15px;
        }

        .max-button:hover {
          text-decoration: underline;
        }

        .input-wrapper {
          width: 420px;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          margin-bottom: 48px;
          background-color: #fafbfc;
        }

        .input-wrapper.error {
          border: solid 1px #ed2a28;
          margin-bottom: 20px;
        }

        .error-box {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          color: #183140;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          background-color: #fff0f0;
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          min-width: 320px;
          margin-bottom: 40px;
        }

        .input-holder {
          width: 250px;
          border-radius: 10px 0px 0px 10px;
          border-right: 1px solid #cdd7e0;
        }

        .input-holder input {
          padding: 11px 0px 11px 16px;
          border: 0px;
          border-radius: 10px;
          background-color: #fafbfc;
          font-size: 28px;
          color: black;
          width: 186px;
        }

        .token-info {
          background-color: white;
          border-radius: 0px 10px 10px 0px;
          padding: 13px;
        }

        .emphasis {
          font-size: 24px;
          text-align: center;
          color: black;
          margin-bottom: 26px;
          margin-top: 5px;
        }

        .mb-22 {
          margin-bottom: 22px !important;
        }

        .mb-16 {
          margin-bottom: 16px !important;
        }

        .btn-dark.inner {
          padding-left: 30px;
          padding-right: 30px;
        }

        .grey-icon-holder {
          width: 45px;
          height: 45px;
          border-radius: 25px;
          background-color: #f2f3f5;
        }

        .grey-icon-holder img {
          max-width: 25px;
          max-height: 25px;
        }

        .green-check {
          width: 45px;
          height: 45px;
        }

        .big-connector-icon {
          width: 42px;
          height: 42px;
          margin-right: 20px;
        }

        .action-text {
          font-size: 18px;
          color: #1e313f;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(StakeModal)
