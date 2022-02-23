import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { ethers } from 'ethers'
import { get } from 'lodash'

import withRpcProvider from 'hoc/withRpcProvider'
import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency, formatCurrencyMinMaxDecimals } from 'utils/math'
import AccountStore from 'stores/AccountStore'
import { useStoreState } from 'pullstate'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import analytics from 'utils/analytics'
import { connectorNameIconMap, getConnectorIcon } from 'utils/connectors'
import { getUserSource } from 'utils/user'
import { assetRootPath } from 'utils/image'

const StakeModal = ({
  tokenAllowanceSuffiscient,
  tokenToStakeDecimalsCall,
  stakeFunctionCall,
  stakeTokenBalance,
  stakeTokenName,
  contractApprovingTokenUsage,
  contractAllowedToMoveTokens,
  stakeButtonText,
  selectTokensAmountTitle,
  approveTokensTitle,
  availableToDepositSymbol,
  tokenIconAndName,
  tokenIcon,
  permissionToUseTokensText,
  onClose,
  onUserConfirmedStakeTx,
  onError,
  rpcProvider,
  className,
  underInputFieldContent,
  onTokensToStakeChange,
}) => {
  /* select-tokens -> where user select amount of tokens to stake
   * approve-tokens -> where user approves token allowance for the contract
   * approve-user-wait -> waiting for the user to approve tokens
   * approve-network-wait -> waiting for the network to mine the tx
   * approve-done -> tokens approved
   * [approve-finalise/select]-user-wait -> waiting for user to finalise transaction
   */
  const [modalState, setModalState] = useState('select-tokens')
  const [tokensToStake, setTokensToStake] = useState(0)
  const [displayedTokensToStake, setDisplayedTokensToStake] = useState(0)
  const [selectTokensError, setSelectTokensError] = useState(null)
  const connectorName = useStoreState(AccountStore, (s) => s.connectorName)
  const connectorIcon = getConnectorIcon(connectorName)

  const getActions = () => {
    if (modalState === 'select-tokens') {
      return [
        {
          text: stakeButtonText,
          isDisabled: !!selectTokensError || parseFloat(tokensToStake) === 0,
          onClick: async () => {
            try {
              if (tokenAllowanceSuffiscient) {
                setModalState('select-user-wait')
                const stakeAmount = ethers.utils.parseUnits(
                  tokensToStake.toString(),
                  await tokenToStakeDecimalsCall()
                )
                const result = await stakeFunctionCall(stakeAmount)
                onUserConfirmedStakeTx(result, {
                  stakeAmount,
                })
                analytics.track('Stake', {
                  amount: tokensToStake,
                  // we already store utm_source as user property. This is for easier analytics
                  utm_source: getUserSource(),
                  token_name: stakeTokenName,
                })
                onClose()
              } else {
                setModalState('approve-tokens')
              }
            } catch (e) {
              onError(e)
              onClose()
            }
          },
        },
      ]
    } else if (
      ['approve-tokens', 'approve-user-wait', 'approve-network-wait'].includes(
        modalState
      )
    ) {
      return [
        {
          text: stakeButtonText,
          isDisabled: true,
          onClick: () => {},
        },
      ]
    } else if (['approve-done'].includes(modalState)) {
      return [
        {
          text: stakeButtonText,
          isDisabled: false,
          onClick: async () => {
            try {
              setModalState('approve-finalise-user-wait')
              const stakeAmount = ethers.utils.parseUnits(
                tokensToStake.toString(),
                await tokenToStakeDecimalsCall()
              )
              const result = await stakeFunctionCall(stakeAmount)
              onUserConfirmedStakeTx(result, {
                stakeAmount,
              })
              analytics.track('Stake', {
                amount: tokensToStake,
                // we already store utm_source as user property. This is for easier analytics
                utm_source: getUserSource(),
                token_name: stakeTokenName,
              })
              onClose()
            } catch (e) {
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

  useEffect(() => {
    if (onTokensToStakeChange) {
      onTokensToStakeChange(tokensToStake)
    }
  }, [tokensToStake])

  // Default to max tokens to stake
  useEffect(() => {
    setTokensInputValue(formatCurrency(stakeTokenBalance, 6))
  }, [])

  const getTitle = () => {
    if (modalState.startsWith('select')) {
      return selectTokensAmountTitle
    } else {
      return approveTokensTitle
    }
  }

  const setTokensInputValue = (value) => {
    const notNullValue = parseFloat(value) < 0 ? '0' : value || '0'
    const valueNoCommas = notNullValue.replace(/,/g, '')
    setTokensToStake(valueNoCommas)
    setDisplayedTokensToStake(value)
    validateTokensToStake(valueNoCommas)
  }

  const validateTokensToStake = (tokensToStake) => {
    if (parseFloat(stakeTokenBalance) < tokensToStake) {
      setSelectTokensError(
        fbt('Insufficient OGN balance', 'Insufficient OGN balance')
      )
    } else {
      setSelectTokensError(null)
    }
  }

  const closeable = () => {
    return ['select-tokens', 'approve-tokens', 'approve-done'].includes(
      modalState
    )
  }

  const maxButtonDisabled =
    displayedTokensToStake === formatCurrency(stakeTokenBalance, 6)
  const onMaxButtonClick = (e) => {
    setTokensInputValue(formatCurrency(stakeTokenBalance, 6))
  }

  return (
    <>
      <EarnModal
        closeable={closeable()}
        onClose={onClose}
        bodyContents={
          <div className={`${className}`}>
            {['select-tokens', 'select-user-wait'].includes(modalState) && (
              <>
                <div className="d-flex flex-column align-items-center">
                  <div className="d-flex justify-content-between align-items-center w-100 center-top">
                    <div>{fbt('Amount to lock up', 'Amount to lock up')}</div>
                    <div
                      className={`small-blue-text available-tokens ${
                        maxButtonDisabled ? 'disabled' : ''
                      }`}
                      onClick={(e) => {
                        if (maxButtonDisabled) {
                          return
                        }
                        onMaxButtonClick(e)
                      }}
                    >
                      {fbt(
                        'Available: ' +
                          fbt.param(
                            'tokens-amount',
                            formatCurrency(stakeTokenBalance, 2)
                          ),
                        'Available tokens to deposit'
                      )}
                      {availableToDepositSymbol
                        ? ' ' + availableToDepositSymbol
                        : ''}
                    </div>
                  </div>
                  <div
                    className={`input-wrapper d-flex ${
                      selectTokensError ? 'error' : ''
                    } ${underInputFieldContent ? '' : 'mb-48'}`}
                  >
                    <div className="input-holder d-flex">
                      <input
                        type="float"
                        placeholder="0.00"
                        value={displayedTokensToStake}
                        onChange={(e) => {
                          const tokens = e.target.value
                          setTokensInputValue(tokens)
                        }}
                        onBlur={(e) => {
                          setDisplayedTokensToStake(
                            tokensToStake !== 0
                              ? formatCurrencyMinMaxDecimals(tokensToStake, {
                                  minDecimals: 0,
                                  maxDecimals: 10,
                                })
                              : ''
                          )
                        }}
                        onFocus={(e) => {
                          if (!tokensToStake) {
                            setDisplayedTokensToStake('')
                          }
                        }}
                      />
                      <button
                        className="max-button"
                        disabled={maxButtonDisabled}
                        onClick={onMaxButtonClick}
                      >
                        {fbt('Max', 'Max tokens to deposit')}
                      </button>
                    </div>
                    <div className="token-info d-flex">{tokenIconAndName}</div>
                  </div>
                  {underInputFieldContent ? underInputFieldContent : ''}
                  {selectTokensError && (
                    <div className="error-box">{selectTokensError}</div>
                  )}
                </div>
              </>
            )}
            {modalState === 'approve-tokens' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                {tokenIcon}
                <div className="emphasis">{permissionToUseTokensText}</div>
                <button
                  className="btn-dark inner mb-22"
                  onClick={async (e) => {
                    try {
                      setModalState('approve-user-wait')
                      const result = await contractApprovingTokenUsage.approve(
                        contractAllowedToMoveTokens.address,
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
                        setModalState('approve-tokens')
                      }
                    } catch (e) {
                      // TODO display there was an error
                      console.log(
                        'ERROR occurred when waiting to confirm transaction ',
                        e
                      )
                      setModalState('approve-tokens')
                    }
                  }}
                >
                  {fbt('Approve', 'Approve')}
                </button>
              </div>
            )}
            {modalState === 'approve-user-wait' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                {tokenIcon}
                <div className="emphasis mb-16">
                  {fbt(
                    'Waiting for you to confirm…',
                    'Waiting for you to confirm…'
                  )}
                </div>
                <div className="grey-icon-holder d-flex align-items-center justify-content-center mb-22">
                  <img src={assetRootPath(`/images/${connectorIcon}`)} />
                </div>
              </div>
            )}
            {modalState === 'approve-network-wait' && (
              <div className="d-flex flex-column justify-content-center align-items-center">
                {tokenIcon}
                <div className="emphasis mb-16">
                  {fbt(
                    'Approving ' +
                      fbt.param('LP token name', stakeTokenName) +
                      '...',
                    'Approving the token for contract usage'
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
                {tokenIcon}
                <div className="emphasis mb-16">
                  {fbt(
                    fbt.param(
                      'Token to be approved name',
                      stakeTokenName.toUpperCase()
                    ) + ' approved',
                    'Token is approved'
                  )}
                </div>
                <img
                  className="mb-22 green-check"
                  src={assetRootPath('/images/green-check.svg')}
                />
              </div>
            )}
          </div>
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
                  src={assetRootPath(`/images/${connectorIcon}`)}
                />
                <div className="action-text">
                  {fbt(
                    'Please confirm your transaction…',
                    'Confirm your transaction'
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

        .max-button:disabled {
          color: grey;
        }

        .max-button:disabled:hover {
          text-decoration: none;
        }

        .input-wrapper {
          width: 100%;
          border-radius: 10px;
          border: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .mb-48 {
          margin-bottom: 48px;
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
          flex-grow: 1;
          border-radius: 10px 0px 0px 10px;
          border-right: 1px solid #cdd7e0;
        }

        .wider-stake-input .input-holder {
          width: 300px;
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

        .wider-stake-input .input-holder input {
          flex-grow: 1;
        }

        .token-info {
          background-color: transparent;
          border-radius: 0px 10px 10px 0px;
          padding: 13px 25px;
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

        .available-tokens:hover:not(.disabled) {
          text-decoration: underline;
          cursor: pointer;
        }

        @media (max-width: 799px) {
          .input-wrapper {
            width: 100%;
          }

          .input-holder {
            width: 60%;
          }

          .wider-stake-input .input-holder {
            width: 70%;
          }

          .input-holder input {
            width: 100%;
          }

          .wider-stake-input .input-holder input {
            width: 100%;
          }

          .token-info {
            padding: 13px;
          }
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(StakeModal)
