import React, { useState, useEffect } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useRouter } from 'next/router'

import withLoginModal from 'hoc/withLoginModal'
import { injected } from 'utils/connectors'
import mixpanel from 'utils/mixpanel'
import { providerName } from 'utils/web3'
import { isMobileMetaMask } from 'utils/device'

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
  connect,
}) => {
  const { activate, active } = useWeb3React()
  const [userAlreadyConnectedWallet, setUserAlreadyConnectedWallet] = useState(
    false
  )
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
            mixpanel.track(connect ? 'Connect' : 'Get OUSD', {
              source: trackSource,
            })

            if (connect) {
              const provider = providerName() || ''
              if (
                provider.match(
                  'coinbase|imtoken|cipher|alphawallet|gowallet|trust|status|mist|parity'
                ) ||
                isMobileMetaMask()
              ) {
                activate(injected)
              } else if (showLogin) {
                showLogin()
              }
            } else {
              router.push('/mint')
            }
          }
        }}
      >
        {!connect && fbt('Get OUSD', 'Get OUSD button')}
        {connect && fbt('Connect', 'Connect button')}
      </button>
      <style jsx>{`
        .btn {
          min-width: 201px;
          min-height: 50px;
          font-size: 1.125rem;
          font-weight: bold;
          border-radius: 25px;
          width: fit-content;
        }

        .zIndex2 {
          position: relative;
          z-index: 2;
        }

        .btn-primary {
          background-color: #1a82ff;
        }

        .btn-light {
          background-color: white;
        }

        .btn-light2 {
          border: solid 1px #1a82ff;
          background-color: #ffffff;
          color: #1a82ff;
        }

        .btn-nav {
          color: white;
          font-size: 0.8125rem;
          font-weight: normal;
          min-height: 0;
          min-width: 0;
        }

        .btn-nav:hover {
          background-color: white;
          color: #183140;
          text-decoration: none;
          opacity: 1;
        }

        @media (max-width: 992px) {
          .btn {
            width: 100%;
          }

          .nav-marble {
            width: auto;
            color: white;
            font-size: 0.6875rem;
            min-width: auto;
            min-height: auto;
            border: solid 1px white;
            border-radius: 15px;
            padding: 5px 15px;
          }
        }
      `}</style>
    </>
  )
}

export default withLoginModal(GetOUSD)
