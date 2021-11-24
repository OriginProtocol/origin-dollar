import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'

import { ledgerConnector } from 'utils/connectors'
import { shortenAddress } from 'utils/web3'
import AccountStore from 'stores/AccountStore'

const LedgerAccountContent = ({}) => {
  const { activate, connector } = useWeb3React()
  const [addresses, setAddresses] = useState([])

  useEffect(() => {
    const loadAddresses = async () => {
      console.log('Loading with', ledgerConnector.baseDerivationPath)
      setAddresses(await ledgerConnector.getAccounts(5))
    }
    loadAddresses()
  }, [connector])

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
    AccountStore.update((s) => {
      s.loginModalState = false
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
        {addresses.map((address) => {
          return (
            <button
              key={address}
              className="text-center"
              onClick={() => onSelectAddress(address)}
            >
              {shortenAddress(address)}
            </button>
          )
        })}
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
      `}</style>
    </>
  )
}

export default LedgerAccountContent
