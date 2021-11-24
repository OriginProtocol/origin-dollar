import React, { useState } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import LoginWidget from 'components/LoginWidget'
import AccountStore from 'stores/AccountStore'
import LedgerDerivationContent from 'components/LedgerDerivationContent'
import LedgerAccountContent from 'components/LedgerAccountContent'

const LoginModal = ({}) => {
  const modalState = useStoreState(AccountStore, (s) => s.loginModalState)

  const close = () => {
    AccountStore.update((s) => {
      s.loginModalState = false
    })
  }

  return (
    <>
      {modalState && (
        <div
          className="login-modal d-flex align-items-center justify-content-center"
          onClick={(e) => {
            e.preventDefault()
            close()
          }}
        >
          {modalState === 'Wallet' && <LoginWidget />}
          {modalState === 'LedgerDerivation' && <LedgerDerivationContent />}
          {modalState === 'LedgerAccounts' && <LedgerAccountContent />}
        </div>
      )}
      <style jsx>{`
        .login-modal {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(24, 49, 64, 0.6);
          z-index: 1000;
        }
      `}</style>
    </>
  )
}

export default LoginModal
