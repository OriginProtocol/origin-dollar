import React, { useState, useEffect } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { event } from '../../lib/gtm'

const CustomConnectButton = ({
  id,
  containerClassName = '',
  className,
  onClick,
  style,
}) => {
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
            className={containerClassName}
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

const GetOUSD = ({ id, className, containerClassName, style, trackSource }) => {
  const { isConnected: active, address, connector } = useAccount()
  const [userAlreadyConnectedWallet, setUserAlreadyConnectedWallet] =
    useState(false)

  useEffect(() => {
    if (
      !userAlreadyConnectedWallet &&
      localStorage.getItem('userConnectedWallet') === 'true'
    ) {
      setUserAlreadyConnectedWallet(true)
    }

    if (!userAlreadyConnectedWallet && active) {
      localStorage.setItem('userConnectedWallet', 'true')
      event({
        event: 'connect',
        connect_address: address?.slice(2),
        connect_wallet: connector?.name.toLowerCase(),
      })
    }
  }, [active])

  return (
    <>
      <CustomConnectButton
        id={id}
        containerClassName={containerClassName}
        className={className}
        style={style}
        onClick={() => {
          if (process.browser) {
            event({ event: 'connect_click' })
          }
        }}
      />
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

export default GetOUSD
