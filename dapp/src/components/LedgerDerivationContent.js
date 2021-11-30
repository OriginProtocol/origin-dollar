import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { ledgerConnector } from 'utils/connectors'

import AccountStore from 'stores/AccountStore'

const LEDGER_OTHER = "44'/60'/0'/0'"
const LEDGER_LEGACY_BASE_PATH = "44'/60'/0'"
const LEDGER_LIVE_BASE_PATH = "44'/60'"

const LedgerDerivationContent = ({}) => {
  const { activate, active } = useWeb3React()
  const [displayError, setDisplayError] = useState(null)

  const errorMessageMap = (error) => {
    if (!error || !error.message) {
      return 'Unknown error'
    }
    if (
      error.message.includes('Ledger device: UNKNOWN_ERROR') ||
      error.message.includes(
        'Failed to sign with Ledger device: U2F DEVICE_INELIGIBLE'
      )
    ) {
      return fbt(
        'Unlock your Ledger wallet and open the Ethereum application',
        'Unlock ledger'
      )
    } else if (error.message.includes('MULTIPLE_OPEN_CONNECTIONS_DISALLOWED')) {
      return fbt(
        'Unexpected error occurred. Please refresh page and try again.',
        'Unexpected login error'
      )
    }
    return error.message
  }

  const options = [
    {
      display: `Ledger Live - m/${LEDGER_LIVE_BASE_PATH}`,
      path: LEDGER_LIVE_BASE_PATH,
    },
    {
      display: `Legacy - m/${LEDGER_LEGACY_BASE_PATH}`,
      path: LEDGER_LEGACY_BASE_PATH,
    },
    {
      display: `Ethereum - m/${LEDGER_OTHER}`,
      path: LEDGER_OTHER,
    },
  ]

  const onSelectDerivationPath = async (path) => {
    try {
      await ledgerConnector.activate()
      await ledgerConnector.setPath(path)
    } catch (error) {
      setDisplayError(errorMessageMap(error))
      return
    }
    AccountStore.update((s) => {
      s.walletSelectModalState = 'LedgerAccounts'
    })
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        className={`ledger-derivation-content d-flex flex-column`}
      >
        <h2>
          {fbt(
            'Select a Ledger derivation path',
            'Select a Ledger derivation path'
          )}
        </h2>
        {options.map((option) => {
          return (
            <button
              key={option.path}
              className="text-center"
              onClick={() => onSelectDerivationPath(option.path)}
            >
              {option.display}
            </button>
          )
        })}
        {displayError && (
          <div className="error d-flex align-items-center justify-content-center">
            {displayError}
          </div>
        )}
      </div>
      <style jsx>{`
        .ledger-derivation-content {
          padding: 34px 34px 46px 34px;
          max-width: 350px;
          min-width: 350px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          background-color: white;
          border-radius: 10px;
        }

        .ledger-derivation-content h2 {
          padding-left: 12px;
          padding-right: 12px;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          line-height: normal;
          margin-bottom: 26px;
        }

        .ledger-derivation-content button {
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

        .error {
          margin-top: 20px;
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

export default LedgerDerivationContent
