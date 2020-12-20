import React, { useState, useEffect } from 'react'
import { useStoreState } from 'pullstate'
import ethers from 'ethers'
import { fbt } from 'fbt-runtime'
import { durationToDays } from 'utils/stake'

import StakeStore from 'stores/StakeStore'
import StakeDetailEquation from 'components/earn/StakeDetailEquation'

const ClaimStakeModal = ({
  showModal,
  setShowModal,
  ognCompensationAmount,
}) => {
  const formatBn = (amount, decimals) => {
    return ethers.utils.formatUnits(amount, decimals)
  }

  const [stakeOptions, setStakeOptions] = useState([])

  const { durations, rates } = useStoreState(StakeStore, (s) => s)

  const close = () => setShowModal(false)

  useEffect(() => {
    if (rates && durations && rates.length > 0 && durations.length > 0) {
      setStakeOptions([
        {
          rate: formatBn(rates[0], 18),
          duration: formatBn(durations[0], 0),
          durationBn: durations[0],
        },
        {
          rate: formatBn(rates[1], 18),
          duration: formatBn(durations[1], 0),
          durationBn: durations[1],
        },
        {
          rate: formatBn(rates[2], 18),
          duration: formatBn(durations[2], 0),
          durationBn: durations[2],
        },
      ])
    }
  }, [durations, rates])

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
              <h1>Claim & Stake OGN</h1>
              <img
                className="close-x"
                src="/images/close-button.svg"
                onClick={close}
              />
            </div>
            <div className="modal-body d-flex flex-column">
              <p>Earn more OGN by selecting a staking option below</p>
              <div className="staking-options d-flex">
                {stakeOptions.map((stakeOption) => (
                  <div className="staking-option">
                    <h3>{stakeOption.rate}%</h3>
                    <p className="mb-2">
                      {durationToDays(stakeOption.duration * 1000)} days
                    </p>
                    <p>{fbt('Annualized Yield', 'Annualized Yield')}</p>
                  </div>
                ))}
              </div>
              <StakeDetailEquation
                duration={false}
                durationText={10}
                rate={100}
                principal={ognCompensationAmount}
                forClaim={true}
              />
            </div>
            <div className="modal-footer d-flex justify-content-center">
              <button className="btn btn-dark">Claim & Stake now</button>
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
          margin: 26px 0px;
        }

        .staking-options .staking-option {
          background-color: #183140;
          color: #fff;
          padding: 18px 20px;
          border-radius: 10px;
          background-color: #183140;
        }

        .staking-options > div:nth-child(2) {
          margin: 0px 10px;
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
        }
      `}</style>
    </>
  )
}

export default ClaimStakeModal
