import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { ledgerConnector } from 'utils/connectors'

import AccountStore from 'stores/AccountStore'
import { getChainId, RPC_HTTP_URLS } from 'utils/connectors'

const LEDGER_LIVE_BASE_PATH = "44'/60'/0'/0"
const LEDGER_CHROME_BASE_PATH = "44'/60'/0"

const LedgerDerivationContent = ({}) => {
  const { activate, active } = useWeb3React()

  const options = [
    {
      display: `Ethereum - ${LEDGER_CHROME_BASE_PATH}`,
      path: LEDGER_CHROME_BASE_PATH,
    },
    {
      display: `Ledger Live - ${LEDGER_LIVE_BASE_PATH}`,
      path: LEDGER_LIVE_BASE_PATH,
    },
  ]

  const onSelectDerivationPath = async (path) => {
    await ledgerConnector.activate()
    await ledgerConnector.setPath(path)
    AccountStore.update((s) => {
      s.loginModalState = 'LedgerAccounts'
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
      `}</style>
    </>
  )
}

export default LedgerDerivationContent
