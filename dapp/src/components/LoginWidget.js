import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'

import { connectorsByName } from 'utils/connectors'
import AccountStore from 'stores/AccountStore'

import analytics from 'utils/analytics'

const LoginWidget = ({}) => {
  const { connector, activate, deactivate, active } = useWeb3React()
  const [activatingConnector, setActivatingConnector] = useState()
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [warningShowTimeout, setWarningShowTimeout] = useState(null)

  useEffect(() => {
    if (active) {
      setActivatingConnector(null)
      closeLoginModal()
    }
  }, [active])

  const closeLoginModal = () => {
    analytics.track('Wallet modal closed')

    AccountStore.update((s) => {
      s.showLoginModal = false
    })
  }

  const errorMessageMap = (error) => {
    if (
      error.message.includes(
        'No Ethereum provider was found on window.ethereum'
      )
    ) {
      return fbt('No ethereum wallet detected', 'no wallet detected')
    } else if (
      error.message.includes('Ledger device: UNKNOWN_ERROR (0x6804)')
    ) {
      return fbt(
        'Unlock your Ledger wallet and open Ethereum application',
        'Unlock ledger and open eth app'
      )
    } else if (
      error.message.includes(
        'Failed to sign with Ledger device: U2F DEVICE_INELIGIBLE'
      )
    ) {
      return fbt(
        'Unlock your Ledger wallet and open Ethereum application',
        'Unlock ledger and open eth app'
      )
    } else if (error.message.includes('MULTIPLE_OPEN_CONNECTIONS_DISALLOWED')) {
      return fbt(
        'Unexpected error occurred. Please refresh page and try again.',
        'Unexpected login error'
      )
    }

    return error.message
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className={`login-widget d-flex flex-column`}
      >
        <h2>
          {fbt(
            'Connect a wallet to get started',
            'Connect a wallet to get started'
          )}
        </h2>
        {Object.keys(connectorsByName).map((name) => {
          const currentConnector = connectorsByName[name].connector
          const activating = currentConnector === activatingConnector
          const connected = currentConnector === connector && active
          const { displayName, fileName } = connectorsByName[name]

          return (
            <button
              key={name}
              className="connector-button d-flex align-items-center"
              disabled={activating}
              onClick={async () => {
                analytics.track('Wallet vendor button clicked', {
                  vendor: name,
                })

                if (name === 'Ledger') {
                  setWarningShowTimeout(
                    setTimeout(() => {
                      setWarning(
                        fbt(
                          'Make sure your Ledger is connected and Ethereum App is opened',
                          'Make sure Ledger connected app opened'
                        )
                      )
                    }, 4000)
                  )
                } else {
                  if (warningShowTimeout) {
                    clearTimeout(warningShowTimeout)
                    setWarningShowTimeout(null)
                  }
                }

                setWarning(null)
                setError(null)
                setActivatingConnector(currentConnector)
                await activate(
                  currentConnector,
                  /* According to documentation: https://github.com/NoahZinsmeister/web3-react/tree/v6/docs#understanding-error-bubbling
                   * if this onError function is specified no changes shall be done to the "useWeb3React" global context.
                   * also with the 3rd parameter being false errors should not be thrown.
                   *
                   * When I test using my ledger Nano S [sparrowDom] the below function doesn't consistently throw errors
                   * when I either lock my Ledger or exit Ethereum app. On my end it sometimes just seems that the errors
                   * are suppressed.
                   */
                  (err) => {
                    console.debug('Setting the error: ', err)
                    setError(err)
                    setActivatingConnector(null)
                  },
                  // do not throw the error, handle it in the onError callback above
                  false
                )
                setWarning(null)
                clearTimeout(warningShowTimeout)
                setWarningShowTimeout(null)
              }}
            >
              <div className="col-2">
                <img
                  className={fileName}
                  src={`/images/${fileName}-icon.svg`}
                />
              </div>
              <div className="col-8">{displayName}</div>
              <div className="col-2"></div>
            </button>
          )
        })}
        {error && (
          <div className="error d-flex align-items-center justify-content-center">
            {errorMessageMap(error)}
          </div>
        )}
        {warning && (
          <div
            className={`warning d-flex align-items-center justify-content-center ${
              error ? 'mt-3' : ''
            }`}
          >
            {warning}
          </div>
        )}
      </div>
      <style jsx>{`
        .login-widget {
          padding: 34px 34px 46px 34px;
          max-width: 350px;
          min-width: 350px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          background-color: white;
          border-radius: 10px;
        }

        .login-widget h2 {
          padding-left: 12px;
          padding-right: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          line-height: normal;
          margin-bottom: 26px;
        }

        .login-widget .connector-button {
          width: 100%;
          height: 50px;
          border-radius: 25px;
          border: solid 1px #1a82ff;
          background-color: white;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
        }

        .login-widget .connector-button:disabled {
          cursor: default;
          opacity: 0.6;
        }

        .login-widget .connector-button img {
          max-height: 27px;
        }

        .login-widget .connector-button img.mew {
          max-height: 30px;
        }

        .login-widget .connector-button:hover {
          background-color: #f8f9fa;
        }

        .login-widget .connector-button:not(:last-child) {
          margin-bottom: 20px;
        }

        .error {
          padding: 5px 8px;
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #ed2a28;
          border-radius: 5px;
          border: solid 1px #ed2a28;
          min-height: 50px;
          width: 100%;
        }

        .warning {
          padding: 5px 8px;
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #1e313f;
          border-radius: 5px;
          border: solid 1px #fec100;
          min-height: 50px;
          width: 100%;
        }
      `}</style>
    </>
  )
}

export default LoginWidget
