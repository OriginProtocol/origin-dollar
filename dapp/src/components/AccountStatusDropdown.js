import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'

import Dropdown from 'components/Dropdown'
import GetOUSD from 'components/GetOUSD'
import { isCorrectNetwork, switchEthereumChain } from 'utils/web3'

import withWalletSelectModal from 'hoc/withWalletSelectModal'
import analytics from 'utils/analytics'

import Content from './_AccountStatusContent'
import AccountStatusIndicator from './_AccountStatusIndicator'

const AccountStatusDropdown = ({ className, showLogin, dapp }) => {
  const { active, account, chainId } = useWeb3React()
  const [open, setOpen] = useState(false)
  const correctNetwork = isCorrectNetwork(chainId)

  return (
    <>
      <Dropdown
        className="dropdown"
        content={<Content className="dropdown-menu show" onOpen={setOpen} />}
        open={open}
        onClose={() => setOpen(false)}
      >
        <a
          className={`account-status d-flex justify-content-center align-items-center clickable ${className} ${
            open ? 'open' : ''
          }`}
          onClick={async (e) => {
            e.preventDefault()
            if (dapp && !active) {
              showLogin()
            } else if (active && !correctNetwork) {
              analytics.track('On Change network', {
                category: 'settings',
              })
              // open the dropdown to allow disconnecting, while also requesting an auto switch to mainnet
              await switchEthereumChain()
              setOpen(true)
            } else if (dapp) {
              setOpen(true)
            }
          }}
        >
          {/* The button id is used by StakeBoxBig to trigger connect when no wallet connected */}
          {((!active && !account) || (!dapp && active && correctNetwork)) && (
            <GetOUSD
              id="main-dapp-nav-connect-wallet-button"
              connect={dapp}
              className="btn-nav"
              trackSource="Account dropdown"
            />
          )}
          <AccountStatusIndicator
            active={active}
            correctNetwork={correctNetwork}
            account={account}
            dapp={dapp}
            withAddress
          />
        </a>
      </Dropdown>
      <style jsx>{`
        .dropdown-menu {
          right: 0;
          left: auto;
          top: 135%;
          border-radius: 10px;
          box-shadow: 0 0 14px 0 rgba(24, 49, 64, 0.1);
          border: solid 1px #cdd7e0;
          background-color: #ffffff;
          padding: 20px 30px 20px 20px;
          min-width: 170px;
        }
        .dropdown-menu .dropdown-marble {
          margin-right: 18px;
        }
        .dropdown-menu a:not(:last-child) > div {
          margin-bottom: 10px;
        }

        .dropdown-menu a {
          color: #183140;
        }

        .dropdown-menu a .active {
          font-weight: bold;
        }

        .dropdown-menu a .active .dropdown-marble {
          font-weight: bold;
          background-color: #183140;
        }

        .account-status {
          height: 30px;
          min-width: 30px;
          border-radius: 15px;
          border: solid 1px white;
        }

        .account-status.clickable {
          cursor: pointer;
        }

        .account-status.open {
          background-color: #183140;
        }

        .account-status.open .address {
          color: white;
        }

        .account-status .address {
          font-size: 14px;
          color: white;
          margin-left: 10px;
          margin-right: 19px;
          margin-bottom: 2px;
        }

        .account-status:hover {
          color: inherit;
          text-decoration: none;
        }
      `}</style>
    </>
  )
}

export default withWalletSelectModal(AccountStatusDropdown)
