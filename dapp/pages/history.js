import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import BalanceHeader from 'components/buySell/BalanceHeader'
import TransactionHistory from 'components/TransactionHistory'
import GetOUSD from 'components/GetOUSD'
import { assetRootPath } from 'utils/image'
import { useAccount } from 'wagmi'
import { useOverrideAccount } from '../src/utils/hooks'
import ErrorModal from '../src/components/buySell/ErrorModal'

const errorMap = [
  {
    errorCheck: (err) => {
      return err === 'invalidAddress'
    },
    friendlyMessage: fbt(
      "Overridden account's address is invalid",
      "Overridden account's address is invalid"
    ),
  },
]

export default function History({ locale, onLocale }) {
  const { isConnected: active } = useAccount()
  const { overrideAccount, isValid } = useOverrideAccount()
  const [showErrorModal, setShowErrorModal] = useState(true)

  return (
    <>
      {!isValid && showErrorModal && (
        <ErrorModal
          error="invalidAddress"
          errorMap={errorMap}
          onClose={() => {
            setShowErrorModal(false)
          }}
        />
      )}
      <Layout locale={locale} onLocale={onLocale}>
        <Nav page={'history'} locale={locale} onLocale={onLocale} />
        <div className="home d-flex flex-column">
          <BalanceHeader />
          {(overrideAccount || active) && <TransactionHistory />}
          {!overrideAccount && !active && (
            <div className="empty-placeholder d-flex flex-column align-items-center justify-content-start">
              <img src={assetRootPath('/images/wallet-icons.svg')} />
              <div className="header-text">
                {fbt('No wallet connected', 'Disconnected dapp message')}
              </div>
              <div className="subtext">
                {fbt(
                  'Please connect an Ethereum wallet',
                  'Disconnected dapp subtext'
                )}
              </div>
              <GetOUSD primary connect trackSource="Dapp widget body" />
            </div>
          )}
        </div>
      </Layout>
      <style jsx>{`
        .empty-placeholder {
          min-height: 470px;
          height: 100%;
          padding: 70px;
          border-radius: 10px;
          border-top: solid 1px #cdd7e0;
          background-color: #fafbfc;
        }

        .header-text {
          font-size: 22px;
          line-height: 0.86;
          text-align: center;
          color: black;
          margin-top: 23px;
          margin-bottom: 10px;
        }

        .subtext {
          font-size: 14px;
          line-height: 1.36;
          text-align: center;
          color: #8293a4;
          margin-bottom: 50px;
        }

        @media (min-width: 799px) {
          .home {
            padding-top: 20px;
          }
        }
      `}</style>
    </>
  )
}
