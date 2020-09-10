import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'

import Dropdown from 'components/Dropdown'
import GetOUSD from 'components/GetOUSD'
import { isCorrectNetwork, truncateAddress } from 'utils/web3'
import withLoginModal from 'hoc/withLoginModal'

import Content from './_AccountStatusContent'

const AccountStatusDropdown = ({ className, showLogin }) => {
  const web3react = useWeb3React()
  const { active, account } = web3react
  const [open, setOpen] = useState(false)
  const correctNetwork = isCorrectNetwork(web3react)

  return (
    <>
      <Dropdown
        className="dropdown"
        content={<Content className="dropdown-menu show" onOpen={setOpen} />}
        open={open}
        onClose={() => setOpen(false)}
      >
        <a
          className={`account-status d-flex justify-content-center align-items-center ${className} ${
            open ? 'open' : ''
          }`}
          onClick={(e) => {
            e.preventDefault()
            if (!active) {
              showLogin()
            } else {
              setOpen(!open)
            }
          }}
        >
          {!active && !account && (
            <GetOUSD className="btn-nav" trackSource="Account dropdown" />
          )}
          {/* What causes !active && account? */}
          {!active && account && <div className="dot" />}
          {active && !correctNetwork && <div className="dot yellow" />}
          {active && correctNetwork && <div className="dot green" />}
          {active && account && (
            <div className="address">{truncateAddress(account)}</div>
          )}
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
        }

        .account-status:hover {
          color: inherit;
          text-decoration: none;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 5px;
          background-color: #ed2a28;
          margin-left: 13px;
        }

        .dot.empty {
          margin-left: 0px;
        }

        .dot.green {
          background-color: #00d592;
        }

        .dot.green.yellow {
          background-color: #ffce45;
        }

        .dot.big {
          width: 16px;
          height: 16px;
          border-radius: 8px;
          margin-right: 12px;
        }

        .dot.yellow.big,
        .dot.green.big {
          margin-left: 0px;
        }
      `}</style>
    </>
  )
}

export default withLoginModal(AccountStatusDropdown)
