import React from 'react'
import { fbt } from 'fbt-runtime'
import CoinImage from './CoinImage'
import { capitalize } from 'utils/utils'
import DisclaimerTooltip from 'components/buySell/DisclaimerTooltip'

const SwapButton = ({
  needsApproval,
  selectedSwap,
  formHasErrors,
  swappingGloballyDisabled,
  selectedBuyCoin,
  stage,
  onBuyNow,
  onApproveNow,
}) => {
  return (
    <>
      {needsApproval && (
        <div className="d-flex flex-column align-items-center justify-content-center justify-content-md-between flex-md-row mt-md-3 mt-2">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="link-detail"
          >
            {/* <span className="pr-2"> */}
            {/*   {fbt( */}
            {/*     'Read about costs associated with OUSD', */}
            {/*     'Read about costs associated with OUSD' */}
            {/*   )} */}
            {/* </span> */}
            {/* <LinkIcon color="1a82ff" /> */}
          </a>
          <button
            //disabled={formHasErrors || buyFormHasWarnings || !totalOUSD}
            className={`btn-blue pl-2 pr-2 buy-button mt-2 mt-md-0 w-100 d-flex justify-content-start`}
            disabled={
              !selectedSwap || formHasErrors || swappingGloballyDisabled
            }
            onClick={onApproveNow}
          >
            {!!stage && (
              <>
                <div className={`d-flex w-25`}>
                  <img
                    className="waiting-icon rotating"
                    src="/images/spinner-green-small.png"
                  />
                </div>
                <div className={`w-50`}>
                  {fbt(
                    'Processing transaction...',
                    'Processing transaction...'
                  )}
                </div>
              </>
            )}
            {!stage && (
              <>
                {
                  <div className={`w-25 d-flex`}>
                    <CoinImage coin={selectedBuyCoin} />
                  </div>
                }
                <div className={`w-50`}>
                  {swappingGloballyDisabled &&
                    process.env.DISABLE_SWAP_BUTTON_MESSAGE}
                  {!swappingGloballyDisabled &&
                    fbt(
                      'Allow ' +
                        fbt.param(
                          'selectedStrategy',
                          capitalize(needsApproval)
                        ) +
                        ' to use your ' +
                        fbt.param(
                          'selectedBuyCoin',
                          selectedBuyCoin.toUpperCase()
                        ),
                      'Approve'
                    )}
                </div>
              </>
            )}
          </button>
          <div className={`button-tooltip`}>
            <DisclaimerTooltip
              className={`d-flex justify-content-end`}
              text={`You must give the ${needsApproval} smart contract permission to move your ${selectedBuyCoin}. This only needs to be done once for each token.`}
              isOpen={needsApproval}
            />
          </div>
        </div>
      )}
      {!needsApproval && (
        <div className="d-flex flex-column align-items-center justify-content-md-between flex-md-row mt-md-3 mt-2">
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="link-detail"
          ></a>
          <button
            className={`btn-blue buy-button mt-2 mt-md-0 w-100`}
            disabled={
              !selectedSwap ||
              formHasErrors ||
              swappingGloballyDisabled ||
              needsApproval
            }
            onClick={onBuyNow}
          >
            {swappingGloballyDisabled &&
              process.env.DISABLE_SWAP_BUTTON_MESSAGE}
            {!swappingGloballyDisabled && fbt('Swap', 'Swap')}
          </button>
        </div>
      )}
      <style jsx>{`
        .waiting-icon {
          width: 26px;
          height: 26px;
        }
        .button-tooltip {
          position: absolute;
          right: 8%;
        }
        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }
        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }
        @media (max-width: 799px) {
          .button-tooltip {
            position: absolute;
            right: 4%;
          }
        }
      `}</style>
    </>
  )
}

export default SwapButton
