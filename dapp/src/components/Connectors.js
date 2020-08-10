import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'

import { injected } from '../connectors'

const connectorsByName = {
  MetaMask: injected,
}

const Connectors = () => {
  const { connector, activate, deactivate, active, error } = useWeb3React()

  const [activatingConnector, setActivatingConnector] = useState()

  return Object.keys(connectorsByName).map((name) => {
    const currentConnector = connectorsByName[name]
    const activating = currentConnector === activatingConnector
    const connected = currentConnector === connector
    const disabled = !!activatingConnector || connected || !!error

    return (
      <div key={name}>
        <button
          className="btn btn-secondary"
          disabled={disabled}
          onClick={() => {
            setActivatingConnector(currentConnector)
            activate(connectorsByName[name])
          }}
        >
          {connected && (
            <span role="img" aria-label="check">
              ✅
            </span>
          )}
          {name}
        </button>
      </div>
    )
  })
}

export default Connectors
