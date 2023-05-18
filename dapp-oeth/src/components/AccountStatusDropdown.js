import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import Dropdown from 'components/Dropdown'
import GetOUSD from 'components/GetOUSD'
import { isCorrectNetwork, switchEthereumChain } from 'utils/web3'
import withWalletSelectModal from 'hoc/withWalletSelectModal'
import Content from './_AccountStatusContent'
import AccountStatusIndicator from './_AccountStatusIndicator'
import { event } from '../../lib/gtm'

const AccountStatusDropdown = ({ className, showLogin }) => {
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
          className={`account-status d-flex justify-content-center align-items-center clickable ${
            active ? 'active' : ''
          } ${className} ${open ? 'open' : ''}`}
          onClick={async (e) => {
            e.preventDefault()
            if (!active) {
              showLogin()
            } else if (active && !correctNetwork) {
              // open the dropdown to allow disconnecting, while also requesting an auto switch to mainnet
              await switchEthereumChain()
              setOpen(true)
            } else {
              setOpen(true)
            }
            event({
              event: 'open_account',
            })
          }}
        >
          {/* The button id is used by StakeBoxBig to trigger connect when no wallet connected */}
          {!active && !account && (
            <GetOUSD
              id="main-dapp-nav-connect-wallet-button"
              className="btn-nav"
              trackSource="Account dropdown"
            />
          )}
          <AccountStatusIndicator
            active={active}
            correctNetwork={correctNetwork}
            account={account}
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
          border: solid 1px #141519;
          background-color: #1e1f25;
          color: #fafbfb;
          padding: 20px 30px 20px 20px;
          min-width: 170px;
          box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25);
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
          padding: 8px 16px;
          border-radius: 56px;
          background-image: linear-gradient(
            90deg,
            #8c66fc -28.99%,
            #0274f1 144.97%
          );
        }

        .account-status.active {
          background-color: #1e1f25;
          background-image: none;
        }

        .account-status.clickable {
          cursor: pointer;
        }

        .account-status.open {
          background-color: #183140;
        }

        .account-status.open .address {
          color: #fafbfb;
        }

        .account-status .address {
          font-size: 14px;
          color: #fafbfb;
        }

        .account-status:hover {
        }

        @media (max-width: 799px) {
          .account-status {
            padding: 8px;
          }
        }
      `}</style>
    </>
  )
}

export default withWalletSelectModal(AccountStatusDropdown)
