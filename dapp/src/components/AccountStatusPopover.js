import React from 'react'
import { useAccount, useNetwork } from 'wagmi'
import { isCorrectNetwork } from 'utils/web3'
import Content from './_AccountStatusContent'
import { assetRootPath } from 'utils/image'
import AccountStatusIndicator from './_AccountStatusIndicator'

const AccountStatusPopover = ({ className }) => {
  const { chain } = useNetwork()
  const { address: account, isConnected: active } = useAccount()
  const chainId = chain?.id
  const correctNetwork = isCorrectNetwork(chainId)

  if (!active && !account) {
    return ''
  }

  return (
    <>
      <button
        className="navbar-toggler"
        type="button"
        data-toggle="collapse"
        data-target=".accountStatusPopover"
        aria-controls="accountStatusPopover"
        aria-expanded="false"
        aria-label="Toggle account popover"
      >
        <div className={`dropdown-marble${className ? ' ' + className : ''}`}>
          <AccountStatusIndicator
            active={active}
            correctNetwork={correctNetwork}
            account={account}
          />
        </div>
      </button>
      <div
        className="accountStatusPopover dark-background collapse"
        data-toggle="collapse"
        data-target=".accountStatusPopover"
        aria-controls="accountStatusPopover"
      />
      <div className="accountStatusPopover account-status-popover collapse navbar-collapse">
        <button
          className="close navbar-toggler"
          type="button"
          data-toggle="collapse"
          data-target=".accountStatusPopover"
          aria-controls="accountStatusPopover"
          aria-expanded="false"
          aria-label="Toggle popover"
        >
          <img
            src={assetRootPath('/images/close.svg')}
            alt="Close icon"
            loading="lazy"
          />
        </button>
        <Content />
      </div>
      <style jsx>{`
        .navbar-toggler {
          padding: 0.25rem 10px;
        }

        .dropdown-marble .dot {
          margin-left: 0;
        }

        .close {
          background: none;
          border: none;
          position: absolute;
          top: 20px;
          right: 10px;
        }

        .account-status-popover {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 100%;
          z-index: 1000;
          transition: all 0.3s ease;
          background-color: #fff;
          width: 250px;
          padding-top: 74px;
        }

        .navbar-collapse.collapsing {
          transition: all 0.3s ease;
          display: block;
          height: 100%;
        }

        .navbar-collapse.show {
          left: calc(100% - 250px);
        }

        .dropdown-marble {
          height: 24px;
          width: 24px;
        }

        .dark-background {
          position: fixed;
          width: 100vw;
          height: 100vh;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          background-color: #000000aa;
          z-index: 3;
        }

        @media (min-width: 800px) {
        }
      `}</style>
    </>
  )
}

export default AccountStatusPopover
