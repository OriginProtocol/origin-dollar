import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'

import { injected, ledger } from '../connectors'

const connectorsByName = {
  Metamask: {
    connector: injected,
    icon: 'metamask.svg'
  },
  Ledger: {
    connector: ledger,
    icon: 'ledger.png'
  }
}

const LoginWidget = ({}) => {
  const { connector, activate, deactivate, active, error } = useWeb3React()
  const [activatingConnector, setActivatingConnector] = useState()

  return <div className="shadowed-box login-widget d-flex flex-column">
    <h2><fbt desc="Please connect a wallet">Please connect a wallet with your stablecoins to start:</fbt></h2>
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
}

export default LoginWidget

require('react-styl')(`
  .login-widget
    padding: 34px 34px 46px 34px
    max-width: 350px
    h2
      padding-left: 12px
      padding-right: 12px
      font-size: 18px
      font-weight: bold
      text-align: center
      line-height: normal
    .connector-button
      width: 100%
      height: 50px
      border-radius: 25px
      border: solid 1px #1a82ff
      background-color: white
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      color: #1a82ff;
      .Metamask
        height: 27px
      .Ledger
        height: 27px
    .connector-button:hover
      background-color: #f8f9fa
    .connector-button:not(:last-child)
      margin-bottom: 20px
`)
