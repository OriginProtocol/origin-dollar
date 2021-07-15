import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import analytics from 'utils/analytics'

import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import withIsMobile from 'hoc/withIsMobile'
import { providerName, trackOUSDInMetaMask, shortenAddress } from 'utils/web3'

const AddOUSDModal = ({ onClose, isMobile }) => {
  const connectorIcon = useStoreState(AccountStore, (s) => s.connectorIcon)
  const ousdAddress = useStoreState(
    ContractStore,
    (s) => s.contracts && s.contracts.ousd.address
  )
  const provider = providerName()
  const [addressCopied, setAddressCopied] = useState(false)

  return (
    <>
      <div
        className="add-ousd-modal d-flex"
        onClick={(e) => {
          onClose()
        }}
      >
        <div
          className="modal-body shadowed-box d-flex flex-column align-items-center justify-content-center"
          onClick={(e) => {
            // so the modal doesn't close
            e.stopPropagation()
          }}
        >
          <div className="d-flex justify-content-center align-items-center mb-4">
            <img className="icon" src="/images/ousd-token-icon.svg" />
            <img className="icon small" src="/images/arrow-icon-dark.svg" />
            <img className="icon" src={`/images/${connectorIcon}`} />
          </div>
          {provider === 'metamask' && (
            <>
              <div className="title">
                {fbt(
                  'Track OUSD balance in MetaMask',
                  'Track OUSD in MetaMask'
                )}
              </div>
              <button
                className="btn-blue mt-4 ml-auto mr-auto"
                onClick={(e) => {
                  trackOUSDInMetaMask(ousdAddress)
                  onClose()
                }}
              >
                {fbt('Add to MetaMask', 'Add to MetaMask')}
              </button>
            </>
          )}
          {provider !== 'metamask' && (
            <div className="contents d-flex flex-column align-items-center">
              <div className="title">
                {fbt(
                  'Track OUSD balance in your Wallet',
                  'Track OUSD in Wallet'
                )}
              </div>
              <CopyToClipboard
                onCopy={() => {
                  if (addressCopied) return
                  setAddressCopied(true)
                  setTimeout(() => {
                    setAddressCopied(false)
                  }, 4000)

                  analytics.track('Vault address copied to clipboard')
                }}
                text={ousdAddress}
              >
                <div>
                  {addressCopied && (
                    <div className="mt-2 copied">{fbt('Copied', 'Copied')}</div>
                  )}
                  {!addressCopied && (
                    <div className="d-flex address-button mt-2 justify-content-center">
                      <div className="copy-text">
                        {isMobile && (
                          <div>
                            {ousdAddress.substring(0, 21)}
                            <br />
                            {ousdAddress.substring(21)}
                          </div>
                        )}
                        {!isMobile && ousdAddress}
                      </div>
                      <div className="copy-image d-flex align-items-center justify-content-center">
                        <img
                          className="clipboard-icon"
                          src="/images/clipboard-icon.svg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CopyToClipboard>
              <div className="d-flex justify-content-center mt-2 small-text">
                <div>{fbt('Decimals:', 'Decimals:')}</div>
                <div className="ml-1">18</div>
              </div>
              <button
                className="btn-blue mt-4 ml-auto mr-auto"
                onClick={(e) => {
                  onClose()
                }}
              >
                {fbt('Close', 'Close')}
              </button>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .add-ousd-modal {
          position: absolute;
          border-radius: 0px 0px 10px 10px;
          border: solid 1px #cdd7e0;
          background-color: rgba(250, 251, 252, 0.6);
          top: -1px;
          right: -1px;
          bottom: -1px;
          left: -1px;
          z-index: 10;
          padding-left: 50px;
          padding-right: 50px;
        }

        .modal-body {
          background-color: white;
          place-self: center;
          padding: 45px 20px 30px 20px;
        }

        .title {
          font-family: Lato;
          font-size: 18px;
          font-weight: bold;
          color: #183140;
          margin-bottom: 7px;
          text-align: center;
          white-space: nowrap;
        }

        .icon {
          width: 40px;
          height: 40px;
          margin-left: 10px;
          margin-right: 10px;
        }

        .icon.small {
          width: 24px;
          height: 24px;
          margin-left: 5px;
          margin-right: 5px;
        }

        .clipboard-icon {
          width: 20px;
          height: 20px;
        }

        .small-text {
          font-family: lato;
          font-size: 12px;
          color: #8293a4;
          font-weight: 500;
        }

        .copy-text {
          border: 1px solid #cdd7e0;
          border-radius: 5px 0px 0px 5px;
          padding: 3px 10px;
          text-align: center;
          cursor: pointer;
          font-weight: 500;
        }

        .copied {
          color: #00d592;
          text-align: center;
          font-weight: 500;
        }

        .copy-image {
          border: 1px solid #cdd7e0;
          border-radius: 0px 5px 5px 0px;
          border-left: 0px;
          min-width: 35px;
          cursor: pointer;
        }

        .contents {
          max-width: 250px;
        }

        .btn-blue {
          line-height: 1.2;
        }

        @media (max-width: 799px) {
          .add-ousd-modal {
            padding-left: 30px;
            padding-right: 30px;
          }

          .small-text {
            min-width: 150px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(AddOUSDModal)
