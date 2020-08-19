import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'

import { injected, ledger } from 'utils/connectors'

const connectorsByName = {
  Metamask: {
    connector: injected,
    icon: 'metamask-icon.svg'
  },
  Ledger: {
    connector: ledger,
    icon: 'ledger-icon.svg'
  }
}

const LoginWidget = ({ inNav }) => {
  const { connector, activate, deactivate, active, error } = useWeb3React()
  const [activatingConnector, setActivatingConnector] = useState()

  return <>
    <div className={`${inNav ? 'nav' : 'shadowed-box'} login-widget d-flex flex-column`}>
      <h2>{fbt('Please connect a wallet with your stablecoins to start:', 'Please connect a wallet with your stablecoins to start:')}</h2>
      {Object.keys(connectorsByName).map((name) => {
        const currentConnector = connectorsByName[name].connector
        const activating = currentConnector === activatingConnector
        const connected = currentConnector === connector
        const disabled = !!activatingConnector || connected || !!error

        return (
          <button
            key={name}
            className="connector-button d-flex align-items-center"
            disabled={disabled}
            onClick={() => {
              setActivatingConnector(currentConnector)
              activate(currentConnector)
              localStorage.setItem('eagerConnect', true)
            }}
          >
            <div className="col-2">
              <img className={name} src={`/images/${connectorsByName[name].icon}`} />
            </div>
            <div className="col-8">{name}</div>
            <div className="col-2"></div>
          </button>
        )
      })}
    </div>
    <style jsx>{`
      .login-widget {
        padding: 34px 34px 46px 34px;
        max-width: 350px;
        min-width: 350px;
      }

      .login-widget.nav {
        padding: 20px;
      }

      .login-widget h2 {
        padding-left: 12px;
        padding-right: 12px;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        line-height: normal;
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

    `}</style>
  </>
}

export default LoginWidget
