import React, { useState, useEffect } from 'react'

import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { injectedConnector } from 'utils/connectors'
import { walletConnectConnector } from 'utils/connectors'
import { myEtherWalletConnector } from 'utils/connectors'

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

  const onConnect = async (name) => {
    analytics.track(`On Connect Wallet`, {
      category: 'general',
      label: name,
    })

    setWarning(null)
    setError(null)

    let connector
    if (name === 'MetaMask') {
      connector = injectedConnector
    } else if (name === 'Ledger') {
      // Display window with derivation path/account select
      AccountStore.update((s) => {
        s.loginModalState = 'LedgerDerivation'
      })
      return
    } else if (name === 'MyEtherWallet') {
      connector = myEtherWalletConnector
    } else if (name === 'WalletConnect') {
      connector = walletConnectConnector
    }

    await activate(
      connector,
      (err) => {
        console.debug('Setting the error: ', err)
        setError(err)
        setActivatingConnector(null)
      },
      // Do not throw the error, handle it in the onError callback above
      false
    )
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
        {['MetaMask', 'Ledger', 'MyEtherWallet', 'WalletConnect'].map(
          (name) => {
            return (
              <button
                key={name}
                className="connector-button d-flex align-items-center"
                onClick={() => onConnect(name)}
              >
                <div className="col-2">
                  <img src={`/images/${name.toLowerCase()}-icon.svg`} />
                </div>
                <div className="col-8">{name}</div>
                <div className="col-2"></div>
              </button>
            )
          }
        )}
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
