import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useRouter } from 'next/router'

import ContractStore from 'stores/ContractStore'
import useStake from 'hooks/useStake'
import { sleep } from 'utils/utils'
import { formatCurrencyMinMaxDecimals } from 'utils/math'
import StakeDetailEquation from 'components/earn/StakeDetailEquation'
import withRpcProvider from 'hoc/withRpcProvider'
import SpinningLoadingCircle from 'components/SpinningLoadingCircle'
import { assetRootPath } from 'utils/image'

const ClaimStakeModal = ({
  showModal,
  setShowModal,
  ognCompensationAmount,
  compensationData,
  rpcProvider,
}) => {
  const router = useRouter()
  const { stakeOptions } = useStake()
  const { ognStaking } = useStoreState(ContractStore, (s) => {
    if (s.contracts) {
      return s.contracts
    }
    return {}
  })
  const [waitingForTransaction, setWaitingForTransaction] = useState(false)
  const [error, setError] = useState(null)
  const close = () => setShowModal(false)

  return (
    <>
      {showModal && (
        <div
          className="modal d-flex justify-content-center align-items-md-center align-items-end"
          onClick={close}
        >
          <div
            className="modal-content shadowed-box d-flex flex-column"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="modal-header d-flex flex-column">
              <h1>{fbt('Claim & Stake OGN', 'Claim & Stake OGN')}</h1>
              <img
                className="close-x"
                src={assetRootPath('/images/close-button.svg')}
                onClick={close}
              />
            </div>
            <div className="modal-body d-flex flex-column">
              <p>
                {fbt(
                  'Earn more OGN by selecting a staking option below',
                  'Earn more OGN by selecting a staking option below'
                )}
              </p>
              <div className="staking-options d-flex justify-content-start">
                {stakeOptions.map((stakeOption, index) => (
                  <div
                    key={`stakeOption_${index}`}
                    className={`staking-option${index != 2 ? ' disabled' : ''}`}
                  >
                    <h3>
                      {formatCurrencyMinMaxDecimals(
                        stakeOption.rate * 100 || 0,
                        {
                          minDecimals: 0,
                          maxDecimals: 1,
                        }
                      )}
                      %
                    </h3>
                    <p className="mb-2">
                      {stakeOption.durationInDays} {fbt('days', 'days')}
                    </p>
                    <p>{fbt('Annualized Yield', 'Annualized Yield')}</p>
                  </div>
                ))}
              </div>
              {stakeOptions.length > 0 ? (
                <StakeDetailEquation
                  duration={stakeOptions[2].duration}
                  durationText={`${stakeOptions[2].durationInDays}d:`}
                  rate={stakeOptions[2].rate}
                  principal={ognCompensationAmount}
                  forClaim={true}
                />
              ) : (
                <></>
              )}
              {error && <div className="error-box">{error}</div>}
            </div>
            <div className="modal-footer d-flex justify-content-center">
              <button
                className="btn btn-dark"
                onClick={async (e) => {
                  try {
                    setError(null)
                    const result = await ognStaking.airDroppedStake(
                      compensationData.account.index,
                      compensationData.account.type,
                      compensationData.account.duration,
                      compensationData.account.rate,
                      compensationData.account.ogn_compensation,
                      compensationData.account.proof
                    )
                    setWaitingForTransaction(true)
                    const receipt = await rpcProvider.waitForTransaction(
                      result.hash
                    )
                    // sleep for 3 seconds on development so it is more noticable
                    if (process.env.NODE_ENV === 'development') {
                      await sleep(3000)
                    }
                    setWaitingForTransaction(false)

                    router.push('/stake')
                  } catch (e) {
                    setError(
                      fbt(
                        'Unexpected error happened when claiming and staking',
                        'Claim and stake error'
                      )
                    )
                    console.error(e)
                    setWaitingForTransaction(false)
                  }
                }}
              >
                {!waitingForTransaction &&
                  fbt('Claim & Stake OGN', 'Claim & Stake OGN')}
                {waitingForTransaction && (
                  <SpinningLoadingCircle backgroundColor="183140" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .modal {
          background-color: rgba(24, 49, 64, 0.6);
          top: 0px;
          right: 0px;
          bottom: 0px;
          left: 0px;
          z-index: 101;
        }

        .modal-content {
          width: auto;
          padding: 0px;
          max-width: 100%;
          max-height: 100%;
          overflow: auto;
        }

        .modal-content .modal-header {
          padding: 25px 0px;
          position: relative;
          border-bottom: 1px solid #cdd7e0;
          margin: 0px 25px;
        }

        .modal-header h1 {
          font-family: Lato;
          font-size: 24px;
          font-weight: bold;
          line-height: normal;
          margin: 0px;
          color: #000000;
        }

        .modal-header .close-x {
          position: absolute;
          top: 27px;
          right: 0px;
          cursor: pointer;
        }

        .modal-header .close-x:hover {
          opacity: 0.8;
        }

        .modal-content .modal-body {
          padding: 16px 25px;
        }

        .modal-content .modal-body p {
          margin: 0px; 
          font-family: Lato; 
          font-size: 16px; 
          color: #8293a4;
        }

        .modal-body .staking-options {
          margin: 20px -5px;
          overflow: auto;
        }

        .staking-options .staking-option {
          margin: 5px;
          background-color: #183140;
          color: #fff;
          padding: 18px 20px;
          border-radius: 10px;
          background-color: #183140;
          flex-basis: 0;
          -moz-box-flex: 1;
          flex-grow: 1;
          max-width: 100%;
          min-width: 118px;
        }
        
        .staking-options .disabled {
          opacity: 0.1; 
          background-color: #1a82ff;
        }

        .staking-options .staking-option h3 {
          font-size: 24px;
          margin: 0px; 
          font-weight: bold; 
          line-height: 1.4;
        }

        .staking-options .staking-option p {
          font-size: 14px;
          color: #fff;
        }

        .modal-content .modal-footer {
          margin-top: 10px;
          padding: 25px;
          background-color: #fafbfc;
          border-top: 1px solid #cdd7e0;
        }

        .modal-content .modal-footer .btn {
          margin: 0px;
          padding: 15px 30px;
          font-size: 18px;
          font-family: Lato;
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
          margin-top: 20px;
        }

        @media (max-width: 576px) {

          .modal-content {
            border-radius: 10px 10px 0 0;
          }

          .modal-content .modal-header {
            margin: 0px 15px;
          }
          
          .modal-content .modal-body {
            padding: 16px 15px;modal-content
          }

          .modal-content .modal-body p {
            font-size: 14px; 
          }
          
          .modal-body .stake-equation {
            padding: 18px 15px;
          }

          .staking-options .staking-option {
            padding: 18px 15px;
          }
          .staking-options .staking-option p {
            font-size: 12px;
          }

          .modal-content .modal-footer {
            padding: 25px 20px;
          }

          .modal-content .modal-footer .btn {
            width: 100%;
          }

        }
      `}</style>
    </>
  )
}

export default withRpcProvider(ClaimStakeModal)
