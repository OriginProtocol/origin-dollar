import React, { useState, useEffect } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useRouter } from 'next/router'

import withWalletSelectModal from 'hoc/withWalletSelectModal'
import { event } from '../../lib/gtm'
import { walletLogin } from 'utils/account'
import { ledgerLiveConnector } from 'utils/connectors'

const GetOUSD = ({
  id,
  className,
  style,
  dark,
  light,
  primary,
  showLogin,
  trackSource,
  light2,
  zIndex2,
  navMarble,
}) => {
  const { activate, active } = useWeb3React()
  const [userAlreadyConnectedWallet, setUserAlreadyConnectedWallet] =
    useState(false)
  const router = useRouter()
  const classList = classnames(
    'btn d-flex align-items-center justify-content-center',
    className,
    dark && 'btn-dark',
    light && 'btn-light',
    light2 && 'btn-light2',
    primary && 'btn-primary',
    zIndex2 && 'zIndex2',
    navMarble && 'nav-marble'
  )
  const ledgerLive = ledgerLiveConnector?.isLedgerApp()

  useEffect(() => {
    if (
      !userAlreadyConnectedWallet &&
      localStorage.getItem('userConnectedWallet') === 'true'
    ) {
      setUserAlreadyConnectedWallet(true)
    }

    if (!userAlreadyConnectedWallet && active) {
      localStorage.setItem('userConnectedWallet', 'true')
    }
  }, [active])

  return (
    <>
      <button
        className={classList}
        id={id}
        style={style}
        onClick={() => {
          if (process.browser) {
            event({'event': 'connect_click'})
            if (ledgerLive) {
              activate(ledgerLiveConnector, undefined, true)
            } else {
              walletLogin(showLogin, activate)
            }
          }
        }}
      >
        {fbt('Connect', 'Connect button')}
      </button>
      <style jsx>{`
        .btn {
          font-size: 1.125rem;
          font-weight: bold;
          border-radius: 25px;
          padding: 0;
        }

        .zIndex2 {
          position: relative;
          z-index: 2;
        }

        .btn-primary {
          background-color: #1a82ff;
        }

        .btn-light {
          background-color: #fafbfb;
        }

        .btn-light2 {
          background-color: #ffffff;
          color: #1a82ff;
        }

        .btn-nav {
          color: #fafbfb;
          font-size: 0.8125rem;
          font-weight: normal;
        }

        @media (max-width: 992px) {
          .btn {
            width: 100%;
          }

          .nav-marble {
            width: auto;
            color: #fafbfb;
            font-size: 0.6875rem;
            border-radius: 56px;
            background-image: linear-gradient(
              90deg,
              #8c66fc -28.99%,
              #0274f1 144.97%
            );
            padding: 5px 15px;
          }
        }
      `}</style>
    </>
  )
}

export default withWalletSelectModal(GetOUSD)
