import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { ledgerConnector } from 'utils/connectors'
import AccountStore from 'stores/AccountStore'
import { formatCurrency } from 'utils/math'
import { shortenAddress } from 'utils/web3'

const LedgerAccountContent = ({
  addresses,
  addressBalances,
  addressStableBalances,
  activePath,
}) => {
  const { activate, provider, connector } = useWeb3React()

  const onSelectAddress = async (address) => {
    await ledgerConnector.setPath(activePath)
    ledgerConnector.setAccount(address)

    await activate(
      ledgerConnector,
      (err) => {
        console.error(err)
      },
      // Do not throw the error, handle it in the onError callback above
      false
    )

    localStorage.setItem('eagerConnect', 'Ledger')
    localStorage.setItem('ledgerAccount', address)
    localStorage.setItem(
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
        className={`d-flex flex-column`}
      >
        {addresses.map((address) => {
          return (
            <button
              key={address}
              className="text-center"
              onClick={() => onSelectAddress(address)}
            >
              {shortenAddress(address)} <br />
              <span className="balance">
                {addressBalances[address] !== undefined && (
                  <>{addressBalances[address]} ETH, </>
                )}
                {addressStableBalances[address] !== undefined && (
                  <>
                    ${formatCurrency(addressStableBalances[address])} in
                    stablecoins
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <style jsx>{`
        button {
          width: 415px;
          height: 55px;
          border-radius: 50px;
          border: solid 1px #1a82ff;
          background-color: white;
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          color: #1a82ff;
          padding: 5px 20px;
          margin: 10px auto;
          line-height: 22px;
        }

        button .balance {
          font-size: 15px;
          color: #808080;
        }
      `}</style>
    </>
  )
}

export default LedgerAccountContent
