import React, { useState, useEffect } from 'react'

import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { injectedConnector } from 'utils/connectors'
import { walletConnectConnector } from 'utils/connectors'
import { myEtherWalletConnector } from 'utils/connectors'
import { walletlink, resetWalletConnector } from 'utils/connectors'

import AccountStore from 'stores/AccountStore'

import analytics from 'utils/analytics'
import { assetRootPath } from 'utils/image'

const WalletSelectContent = ({}) => {
  const { connector, activate, deactivate, active } = useWeb3React()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (active) {
      closeWalletSelectModal()
    }
  }, [active])

  const closeWalletSelectModal = () => {
    AccountStore.update((s) => {
      s.walletSelectModalState = false
    })
  }

  const errorMessageMap = (error) => {
    if (
      error.message.includes(
        'No Ethereum provider was found on window.ethereum'
      )
    ) {
      return fbt('No Ethereum wallet detected', 'No wallet detected')
    }
    return error.message
  }

  const onConnect = async (name) => {
    analytics.track(`On Connect Wallet`, {
      category: 'general',
      label: name,
    })

    setError(null)

    let connector
    if (name === 'MetaMask') {
      connector = injectedConnector
      localStorage.setItem('eagerConnect', name)
    } else if (name === 'Ledger') {
      // Display window with derivation path select
      AccountStore.update((s) => {
        s.walletSelectModalState = 'LedgerDerivation'
      })
      return
    } else if (name === 'MyEtherWallet') {
      connector = myEtherWalletConnector
    } else if (name === 'WalletConnect') {
      connector = walletConnectConnector
    } else if (name === 'CoinbaseWallet') {
      connector = walletlink
    }
    // fix wallet connect bug: if you click the button and close the modal you wouldn't be able to open it again
    if (name === 'WalletConnect') {
      resetWalletConnector(connector)
    }

    await activate(
      connector,
      (err) => {
        setError(err)
      },
      // Do not throw the error, handle it in the onError callback above
      false
    )

    AccountStore.update((s) => {
      s.connectorName = name
    })
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className={`wallet-select-content d-flex flex-column`}
      >
        <h2>
          {fbt(
            'Connect a wallet to get started',
            'Connect a wallet to get started'
          )}
        </h2>
        {[
          'MetaMask',
          'Ledger',
          'CoinbaseWallet',
          'WalletConnect',
          'MyEtherWallet',
        ].map((name) => {
          return (
            <button
              key={name}
              className="connector-button d-flex align-items-center"
              onClick={() => onConnect(name)}
            >
              <div className="col-2">
                <img
                  src={assetRootPath(`/images/${name.toLowerCase()}-icon.svg`)}
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
        .wallet-select-content {
          padding: 34px 34px 46px 34px;
          max-width: 350px;
          min-width: 350px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          background-color: white;
          border-radius: 10px;
        }

        .wallet-select-content h2 {
          padding-left: 12px;
          padding-right: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          line-height: normal;
          margin-bottom: 26px;
        }

        .wallet-select-content .connector-button {
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

        .wallet-select-content .connector-button:disabled {
          cursor: default;
          opacity: 0.6;
        }

        .wallet-select-content .connector-button img {
          max-height: 27px;
        }

        .wallet-select-content .connector-button img.mew {
          max-height: 30px;
        }

        .wallet-select-content .connector-button:hover {
          background-color: #f8f9fa;
        }

        .wallet-select-content .connector-button:not(:last-child) {
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

export default WalletSelectContent
