import React, { useState, useEffect } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useRouter } from 'next/router'
import { event } from '../../lib/gtm'
import { useAccount } from 'wagmi'

const CustomConnectButton = ({ id, className, onClick, style }) => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    id={id}
                    className={classnames(
                      'bg-transparent border-0 text-white',
                      className
                    )}
                    style={style}
                    onClick={() => {
                      openConnectModal()
                      onClick()
                    }}
                    type="button"
                  >
                    {fbt('Connect', 'Connect button')}
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button
                    id={id}
                    className={className}
                    style={style}
                    onClick={openChainModal}
                    type="button"
                  >
                    {fbt('Wrong Network', 'Wrong Network')}
                  </button>
                )
              }

              return (
                <button
                  onClick={openAccountModal}
                  type="button"
                  className={classnames(
                    'bg-transparent border-0 text-white',
                    className
                  )}
                  style={style}
                >
                  {account.displayName}
                </button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

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
  gradient,
  zIndex2,
  navMarble,
}) => {
  const { isConnected: active } = useAccount()
  const [userAlreadyConnectedWallet, setUserAlreadyConnectedWallet] =
    useState(false)

  const router = useRouter()

  const classList = classnames(className)

  // classnames(
  //   'btn d-flex align-items-center justify-content-center',
  //   className,
  //   dark && 'btn-dark',
  //   light && 'btn-light',
  //   light2 && 'btn-light2',
  //   primary && 'btn-primary',
  //   gradient && 'btn-gradient',
  //   zIndex2 && 'zIndex2',
  //   navMarble && 'nav-marble'
  // )

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
      <CustomConnectButton
        id={id}
        className={classList}
        style={style}
        onClick={() => {
          if (process.browser) {
            event({ event: 'connect_click' })
          }
        }}
      />
      <style jsx>{`
        .btn {
          font-size: 1rem;
          font-weight: bold;
          border-radius: 25px;
          padding: 0;
        }

        .btn-gradient {
          background-image: linear-gradient(
            90deg,
            #8c66fc -28.99%,
            #0274f1 144.97%
          );
          color: white;
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
          font-size: 16px;
          font-weight: 500;
          letter-spacing: 0em;
          text-align: left;
        }

        @media (max-width: 992px) {
          .btn {
            width: 100%;
          }

          .max-w-107 {
            max-width: 107px;
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

export default GetOUSD
