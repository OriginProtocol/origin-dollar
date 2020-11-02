import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'

import PoolNameAndIcon from 'components/earn/PoolNameAndIcon'
import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency } from 'utils/math'

const StakeModal = ({ pool }) => {
  /* select-tokens -> where user select amount of tokens to stake
   * approve-lp -> where user approves LP token allowance for the contract
   * approve-user-wait -> waiting for the user to approve tokens
   * approve-network-wait -> waiting for the network to mine the tx
   * approve-done -> tokens approved
   * [approve/stake]-user-wait -> waiting for user to finalise transaction
   * [approve/stake]-network-wait -> waiting for network to mine the tx
   * [approve/stake]-done -> done window
   */
  const [modalState, setModalState] = useState('select-tokens')
  const [lpTokensToStake, setLpTokensToStake] = useState(0)
  const [displayedLpTokensToStake, setDisplayedLpTokensToStake] = useState(0)
  const lpTokenAllowanceApproved = false

  const getActions = () => {
    if (modalState === 'select-tokens') {
      return [{
        text: fbt('Stake', 'Stake'),
        isDisabled: false,
        onClick: () => {
          if (lpTokenAllowanceApproved) {
            // TODO: call the stake on the contract
          } else {
            setModalState('approve-lp')
          }
        }
      }]
    }
  }
  const actions = getActions()

  const setLPTokensInputValue = (value) => {
    const notNullValue = parseFloat(value) < 0 ? '0' : value || '0'
    const valueNoCommas = notNullValue.replace(/,/g, '')
    setLpTokensToStake(valueNoCommas)
    setDisplayedLpTokensToStake(value)
  }

  return (
    <>
      <EarnModal
        closable={true}
        bodyContents={<>
          {modalState === 'select-tokens' && <>
            <div className="d-flex flex-column align-items-center">
              <div className="small-blue-text center-top">
                {fbt('Available to stake: ' + fbt.param('lp-tokens', formatCurrency(pool.lp_tokens, 0)), 'Available LP tokens')}
              </div>
              <div className="input-wrapper d-flex">
                <div className="input-holder d-flex">
                  <input
                    type="float"
                    placeholder="0.00"
                    value={ displayedLpTokensToStake }
                    onChange={e => {
                      setLPTokensInputValue(e.target.value)
                    }}
                    onBlur={(e) => {
                      setDisplayedLpTokensToStake(
                        lpTokensToStake !== 0 ? formatCurrency(lpTokensToStake, 6) : ''
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
                    onClick={e => {
                      
                    }}
                  >
                    {fbt('Max', 'Max LP tokens')}
                  </button>
                </div>
                <div className="token-info d-flex">
                  <PoolNameAndIcon smallText pool={pool}/>
                </div>
              </div>
            </div>
          </>}
          {modalState === 'select-tokens' && <>

          </>}
        </>}
        title={fbt('Stake LP Tokens', 'Stake LP Tokens')}
        actions={actions}
        isWaitingForTxConfirmation={false}
        isWaitingForNetwork={false}
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

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default StakeModal
