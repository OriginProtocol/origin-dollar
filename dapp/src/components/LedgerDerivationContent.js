import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { LedgerConnector } from '@web3-react/ledger-connector'

import AccountStore from 'stores/AccountStore'
import { getChainId, RPC_HTTP_URLS } from 'utils/connectors'

const LedgerDerivationContent = ({}) => {
  const { activate, active } = useWeb3React()

  const options = [
    {
      display: "Ethereum - m/44'/60'/0",
      path: "m/44'/60'/0",
    },
    {
      display: "Ledger Live - m/44'/60'",
      path: "m/44'/60'",
    },
  ]

  const onSelectDerivationPath = async (path) => {
    const connector = new LedgerConnector({
      chainId: getChainId(),
      url: RPC_HTTP_URLS[1],
      baseDerivationPath: path,
    })

    await activate(
      connector,
      (err) => {
        console.error(err)
      },
      // Do not throw the error, handle it in the onError callback above
      false
    )

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
