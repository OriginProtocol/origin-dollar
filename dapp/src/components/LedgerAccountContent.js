import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { zipObject } from 'lodash'

import { ledgerConnector } from 'utils/connectors'
import { shortenAddress } from 'utils/web3'
import AccountStore from 'stores/AccountStore'

const LedgerAccountContent = ({}) => {
  const { activate, provider, connector } = useWeb3React()
  const [addresses, setAddresses] = useState([])
  const [addressBalances, setAddressBalances] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAddresses = async () => {
      if (ledgerConnector.provider) {
        setAddresses(await ledgerConnector.getAccounts(5))
        setLoading(false)
      }
    }
    loadAddresses()
  }, [])

  useEffect(() => {
    const loadBalances = async () => {
      if (ledgerConnector.provider) {
        const balances = await Promise.all(
          addresses.map((a) =>
            ledgerConnector
              .getBalance(a)
              .then((r) => (Number(r) / 1e18).toFixed(2))
          )
        )
        setAddressBalances(zipObject(addresses, balances))
      }
    }
    loadBalances()
  }, [addresses])

  const onSelectAddress = async (address) => {
    ledgerConnector.setAccount(address)

    await activate(
      ledgerConnector,
      (err) => {
        console.error(err)
      },
      // Do not throw the error, handle it in the onError callback above
      false
    )

    await localStorage.setItem('eagerConnect', 'Ledger')
    await localStorage.setItem('ledgerAccount', address)
    await localStorage.setItem(
      'ledgerDerivationPath',
      ledgerConnector.baseDerivationPath
    )

    AccountStore.update((s) => {
      s.connectorName = 'Ledger'
      s.walletSelectModalState = false
    })
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className={`ledger-account-content d-flex flex-column`}
      >
        <h2>{fbt('Select a Ledger account', 'Select a Ledger account')}</h2>
        {loading ? (
          <img
            className="waiting-icon rotating mx-auto"
            src="/images/spinner-green-small.png"
          />
        ) : (
          addresses.map((address) => {
            return (
              <button
                key={address}
                className="text-center"
                onClick={() => onSelectAddress(address)}
              >
                {shortenAddress(address)}{' '}
                {addressBalances[address] !== undefined && (
                  <>({addressBalances[address]} ETH)</>
                )}
              </button>
            )
          })
        )}
      </div>
      <style jsx>{`
        .ledger-account-content {
          padding: 34px 34px 46px 34px;
          max-width: 350px;
          min-width: 350px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          background-color: white;
          border-radius: 10px;
        }

        .ledger-account-content h2 {
          padding-left: 12px;
          padding-right: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          line-height: normal;
          margin-bottom: 26px;
        }

        .ledger-account-content button {
          width: 100%;
          height: 50px;
          border-radius: 25px;
          border: solid 1px #1a82ff;
          background-color: white;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
          padding: 10px 20px;
          margin-top: 20px;
        }

        .waiting-icon {
          width: 25px;
          height: 25px;
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
      `}</style>
    </>
  )
}

export default LedgerAccountContent
