import React from 'react'
import { fbt } from 'fbt-runtime'

import useStake from 'utils/useStake'
import StakeDetailEquation from 'components/earn/StakeDetailEquation'

const ClaimStakeModal = ({
  showModal,
  setShowModal,
  ognCompensationAmount,
}) => {
  const { stakeOptions } = useStake()

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
                src="/images/close-button.svg"
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
              <div className="staking-options d-flex flex-wrap justify-content-start">
                {stakeOptions.map((stakeOption, index) => (
                  <div
                    key={`stakeOption_${index}`}
                    className={`staking-option${index != 2 ? ' disabled' : ''}`}
                  >
                    <h3>{stakeOption.rate}%</h3>
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
            </div>
            <div className="modal-footer d-flex justify-content-center">
              <button className="btn btn-dark">
                {fbt('Claim & Stake OGN', 'Claim & Stake OGN')}
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

export default ClaimStakeModal
