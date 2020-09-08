import React from 'react'
import { useWeb3React } from '@web3-react/core'
import { fbt } from 'fbt-runtime'

import { isCorrectNetwork } from 'utils/web3'
import withLoginModal from 'hoc/withLoginModal'

import Content from './_AccountStatusContent'

const AccountStatusPopover = ({ className }) => {
  const web3react = useWeb3React()
  const { active, account } = web3react
  const correctNetwork = isCorrectNetwork(web3react)

  return (
    <>
      <button
        className="navbar-toggler"
        type="button"
        data-toggle="collapse"
        data-target="#accountStatusPopover"
        aria-controls="accountStatusPopover"
        aria-expanded="false"
        aria-label="Toggle account popover"
      >
        <div className={`dropdown-marble${className ? ' ' + className : ''}`}>
          {!active && account && <div className="dot" />}
          {active && !correctNetwork && <div className="dot yellow" />}
          {active && correctNetwork && <div className="dot green" />}
        </div>
      </button>
      <div
        id="accountStatusPopover"
        className="account-status-popover collapse navbar-collapse"
      >
        <button
          className="close navbar-toggler"
          type="button"
          data-toggle="collapse"
          data-target="#accountStatusPopover"
          aria-controls="accountStatusPopover"
          aria-expanded="false"
          aria-label="Toggle popover"
        >
          <img src="/images/close.svg" alt="Close icon" loading="lazy" />
        </button>
        <Content />
      </div>
      <style jsx>{`
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

        .dropdown-marble .dot {
          margin-left: 0;
        }

        .close {
          background: none;
          border: none;
          position: absolute;
          top: 30px;
          right: 30px;
        }

        .account-status-popover {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 100%;
          z-index: 1000;
          transition: all 0.3s ease;
          background-color: #fff;
          width: 320px;
          padding-top: 74px;
        }

        .navbar-collapse.collapsing {
          transition: all 0.3s ease;
          display: block;
          height: 100%;
        }

        .navbar-collapse.show {
          left: calc(100% - 320px);
        }

        .dropdown-marble {
          height: 24px;
          width: 24px;
        }

        @media (min-width: 800px) {
          .navbar-toggler {
            display: none !important;
          }

          .account-status-popover {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}

export default withLoginModal(AccountStatusPopover)
