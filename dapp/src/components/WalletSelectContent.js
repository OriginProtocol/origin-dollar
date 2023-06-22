import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import {
  defiWalletConnector,
  injectedConnector,
  walletConnectConnector,
  walletConnectV2Connector,
  walletlink,
  resetWalletConnector,
} from 'utils/connectors'
import { event } from '../../lib/gtm'
import withIsMobile from 'hoc/withIsMobile'

import AccountStore from 'stores/AccountStore'

import { assetRootPath } from 'utils/image'

const WalletSelectContent = ({ isMobile, onClose }) => {
  const { activate, active, account } = useWeb3React()
  const [error, setError] = useState(null)
  const wallets = isMobile
    ? ['Wallet Connect V2', 'Coinbase Wallet', 'MetaMask', 'Ledger']
    : [
        'MetaMask',
        'Ledger',
        'Exodus',
        'Coinbase Wallet',
        'Wallet Connect V2',
        'DeFi Wallet',
      ]

  useEffect(() => {
    if (active) {
      onClose()
      event({
        event: 'connect',
        connect_address: account?.slice(2),
      })
    }
  }, [active])

  const errorMessageMap = (error) => {
    if (error === 'ledger-error') {
      return fbt(
        'Please use WalletConnect to connect to Ledger Live',
        'No Ledger on mobile'
      )
    }
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
    event({
      event: 'connect_modal_click',
      connect_modal_wallet: name.toLowerCase(),
    })

    setError(null)

    let connector
    if (name === 'MetaMask' || name === 'Exodus') {
      connector = injectedConnector
      localStorage.setItem('eagerConnect', name)
    } else if (name === 'Ledger') {
      // Display window with derivation path select
      AccountStore.update((s) => {
        s.walletSelectModalState = 'LedgerDerivation'
      })
      return
    } else if (name === 'WalletConnect') {
      connector = walletConnectConnector
    } else if (name === 'Wallet Connect V2') {
      connector = walletConnectV2Connector
      onClose()
    } else if (name === 'Coinbase Wallet') {
      connector = walletlink
    } else if (name === 'DeFi Wallet') {
      connector = defiWalletConnector
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
        {wallets.map((name) => {
          return (
            <button
              key={name}
              className={`connector-button d-flex align-items-center ${
                isMobile && name === 'Ledger' ? 'grey' : ''
              }`}
              onClick={() => {
                if (isMobile && name === 'MetaMask') {
                  setError(null)
                  window.location.href =
                    process.env.NEXT_PUBLIC_METAMASK_DEEPLINK
                } else if (isMobile && name === 'Ledger') {
                  setError('ledger-error')
                } else {
                  onConnect(name)
                }
              }}
            >
              <div className="col-1">
                <img
                  src={assetRootPath(
                    `/images/${name.toLowerCase().replace(/\s+/g, '')}-icon.${
                      name === 'DeFi Wallet' ? 'png' : 'svg'
                    }`
                  )}
                />
              </div>
              <div className="col-10">{name}</div>
              <div className="col-1"></div>
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
          max-width: 360px;
          min-width: 360px;
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

        .wallet-select-content .grey {
          cursor: default;
          opacity: 0.4;
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

export default withIsMobile(WalletSelectContent)
