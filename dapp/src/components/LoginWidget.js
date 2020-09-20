import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'

import {
  injected,
  ledger,
  walletConnect,
  connectorsByName,
  getConnector,
} from 'utils/connectors'
import AccountStore from 'stores/AccountStore'

import mixpanel from 'utils/mixpanel'

const LoginWidget = ({}) => {
  const { connector, activate, deactivate, active, error } = useWeb3React()
  const [activatingConnector, setActivatingConnector] = useState()

  const closeLoginModal = () => {
    mixpanel.track('Wallet modal closed')

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
    }

    return error.message
  }

  useEffect(() => {
    if (connector) {
      const lastConnector = getConnector(connector)
      if (active) {
        mixpanel.track('Wallet connected', {
          vendor: lastConnector.name,
          eagerConnect: false,
        })
        AccountStore.update((s) => {
          s.connectorIcon = lastConnector.icon
        })
        setActivatingConnector(null)
        localStorage.setItem('eagerConnect', true)
        closeLoginModal()
      } else {
        AccountStore.update((s) => {
          s.connectorIcon = null
        })
      }
    }
  }, [active])

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
            'Please connect a wallet with your stablecoins to start:',
            'Please connect a wallet with your stablecoins to start:'
          )}
        </h2>
        {Object.keys(connectorsByName).map((name) => {
          const currentConnector = connectorsByName[name].connector
          const activating = currentConnector === activatingConnector
          const connected = currentConnector === connector && active

          return (
            <button
              key={name}
              className="connector-button d-flex align-items-center"
              onClick={async () => {
                mixpanel.track('Wallet vendor button clicked', {
                  vendor: name,
                })
                setActivatingConnector(currentConnector)
                await activate(currentConnector)
              }}
            >
              <div className="col-2">
                <img
                  className={name}
                  src={`/images/${connectorsByName[name].icon}`}
                />
              </div>
              <div className="col-8">{name}</div>
              <div className="col-2"></div>
            </button>
          )
        })}
        {error && (
          <div className="error d-flex align-items-center justify-content-center">
            {errorMessageMap(error)}
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

        .login-widget .connector-button .Metamask {
          height: 27px;
        }

        .login-widget .connector-button .Ledger {
          height: 27px;
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
      `}</style>
    </>
  )
}

export default LoginWidget
