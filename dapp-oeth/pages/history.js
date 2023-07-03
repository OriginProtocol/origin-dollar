import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import Layout from 'components/layout'
import Nav from 'components/Nav'
import BalanceHeader from 'components/buySell/BalanceHeader'
import TransactionHistory from 'components/TransactionHistory'
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
  const { isValid } = useOverrideAccount()
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
      <Nav page={'history'} locale={locale} onLocale={onLocale} />
      <Layout locale={locale} onLocale={onLocale}>
        <div className="home d-flex flex-column">
          <BalanceHeader />
          <TransactionHistory />
        </div>
      </Layout>
      <style jsx>{`
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
