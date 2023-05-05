import React, { useEffect, useState } from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useWeb3React } from '@web3-react/core'
import withIsMobile from 'hoc/withIsMobile'
import GetOUSD from 'components/GetOUSD'
import Dropdown from 'components/Dropdown'
import AccountStatusDropdown from 'components/AccountStatusDropdown'
import LanguageOptions from 'components/LanguageOptions'
import TransactionActivity from 'components/transactionActivity/TransactionActivity'
import IPFSDappLink from 'components/IPFSDappLink'
import ContractStore from 'stores/ContractStore'
import AccountStatusPopover from './AccountStatusPopover'
import { adjustLinkHref } from 'utils/utils'
import { assetRootPath } from 'utils/image'
import TransactionStore from 'stores/TransactionStore'
import { usePrevious } from 'utils/hooks'

const environment = process.env.NODE_ENV

const DappLinks = ({ page }) => {
  return (
    <>
      <div className="d-flex align-items-center justify-content-center dapp-navigation mr-auto flex-wrap">
        <Link href={adjustLinkHref('/')}>
          <a
            className={`d-flex align-items-center ml-md-0 ${
              page === 'swap' ? 'selected' : ''
            }`}
          >
            {fbt('Swap', 'Swap')}
          </a>
        </Link>
        <Link href={adjustLinkHref('/wrap')}>
          <a
            className={`d-flex align-items-center ${
              page === 'wrap' ? 'selected' : ''
            }`}
          >
            {fbt('Wrap', 'Wrap')}
          </a>
        </Link>
        <Link href={adjustLinkHref('/history')}>
          <a
            className={`d-flex align-items-center ${
              page === 'history' ? 'selected' : ''
            }`}
          >
            {fbt('History', 'History')}
          </a>
        </Link>
      </div>
      <style jsx>{`
        .dapp-navigation {
          font-family: Inter;
          font-size: 14px;
          color: #fafbfb;
          margin-left: 50px;
        }

        .dapp-navigation a {
          padding: 6px 4px;
          margin-left: 16px;
          margin-right: 16px;
          white-space: nowrap;
          margin-bottom: 1px;
        }

        .dapp-navigation a.selected {
          border-bottom: solid 1px white;
          margin-bottom: 0px;
          font-weight: bold;
        }

        @media (max-width: 992px) {
          .dapp-navigation {
            margin-top: -10px;
            margin-left: 0px;
            margin-bottom: 10px;
          }

          .dapp-navigation a {
            margin-left: 24px;
            margin-right: 24px;
          }
        }

        @media (max-width: 485px) {
          .dapp-navigation a {
            margin-left: 8px;
            margin-right: 8px;
          }
        }
      `}</style>
    </>
  )
}

const TransactionActivityDropdown = () => {
  const [open, setOpen] = useState(false)
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const prevTransactions = usePrevious(transactions)
  const [txHashesToAnimate, setTxHashesToAnimate] = useState([])
  const [sortedTransactions, setSortedTransactions] = useState([])

  useEffect(() => {
    // check which transactions have newly arrived
    if (prevTransactions && prevTransactions.length !== 0) {
      const prevTxHashes = prevTransactions.map((tx) => tx.hash)
      setTxHashesToAnimate([
        ...txHashesToAnimate,
        ...transactions
          .filter((tx) => !prevTxHashes.includes(tx.hash))
          .map((tx) => tx.hash),
      ])
    }

    const sortedTx = [...transactions]
    /* need to create a separate array from `transactions` one, otherwise the
     * useEffect with the sorted `transactions` as second parameters triggers
     * on each render.
     */
    sortedTx.sort((a, b) => {
      if (!b.mined && !a.mined) return 0
      else if (!b.mined) return 10
      else if (!a.mined) return -10
      else return b.blockNumber - a.blockNumber
    })
    const filteredTx = sortedTx.filter((tx) => {
      return (
        tx.type !== 'approveWrap' && tx.type !== 'wrap' && tx.type !== 'unwrap'
      )
    })
    setSortedTransactions(filteredTx)
  }, [transactions])

  const lastProcessedTransaction = sortedTransactions?.[0]

  const shouldAnimate =
    lastProcessedTransaction &&
    txHashesToAnimate?.includes(lastProcessedTransaction.hash)

  return (
    <>
      <Dropdown
        className="dropdown"
        content={
          <TransactionActivity
            animateHashes={txHashesToAnimate}
            transactions={sortedTransactions}
          />
        }
        open={open}
        onClose={() => setOpen(false)}
      >
        <button
          className="activity-toggle"
          onClick={(e) => {
            setOpen((prev) => !prev)
          }}
        >
          {shouldAnimate ? (
            !lastProcessedTransaction?.mined ? (
              <img
                className="activity-icon rotating"
                src={assetRootPath('/images/activity-pending.png')}
                alt="Transaction activity pending"
              />
            ) : lastProcessedTransaction?.mined &&
              !lastProcessedTransaction?.isError ? (
              <img
                className="activity-icon "
                src={assetRootPath('/images/activity-success.png')}
                alt="Transaction activity success"
              />
            ) : (
              <img
                className="activity-icon"
                src={assetRootPath('/images/activity-failed.png')}
                alt="Transaction activity failed"
              />
            )
          ) : (
            <img
              className="activity-icon"
              src={assetRootPath('/images/activity.png')}
              alt="Transaction activity button"
            />
          )}
        </button>
      </Dropdown>
      <style jsx>{`
        .activity-toggle {
          width: 44px;
          height: 44px;
          background: #1e1f25;
          box-shadow: 0px 27px 80px rgba(0, 0, 0, 0.07),
            0px 6.0308px 17.869px rgba(0, 0, 0, 0.0417275),
            0px 1.79553px 5.32008px rgba(0, 0, 0, 0.0282725);
          border-radius: 100px;
          margin-left: 10px;
          border: none;
        }

        .activity-icon {
          width: 25px;
          height: 25px;
        }

        .dropdown-menu {
          right: 0;
          left: auto;
          top: 150%;
          border-radius: 10px;
          border: solid 1px #141519;
          background-color: #1e1f25;
          color: #fafbfb;
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

        .rotating {
          -webkit-animation: spin 2s linear infinite;
          -moz-animation: spin 2s linear infinite;
          animation: spin 2s linear infinite;
        }

        @-moz-keyframes spin {
          100% {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes spin {
          100% {
            -webkit-transform: rotate(360deg);
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  )
}

const Nav = ({ isMobile, locale, onLocale, page }) => {
  const { pathname } = useRouter()
  const { active, account } = useWeb3React()
  const apy = useStoreState(ContractStore, (s) => s.apy.apy30 || 0)

  return (
    <>
      <nav
        className={classnames(
          'navbar navbar-expand-lg d-flex justify-content-center flex-column dapp'
        )}
      >
        <div className="container flex-nowrap">
          <Link href={adjustLinkHref('/')}>
            <a className="navbar-brand d-flex flex-column justify-content-center">
              <img
                src={assetRootPath('/images/origin-ether-logo.svg')}
                className="origin-logo"
                alt="OETH logo"
                width={204}
              />
            </a>
          </Link>
          {/*<button*/}
          {/*  className="navbar-toggler d-lg-none ml-auto"*/}
          {/*  type="button"*/}
          {/*  data-toggle="collapse"*/}
          {/*  data-target=".primarySidePanel"*/}
          {/*  aria-controls="primarySidePanel"*/}
          {/*  aria-expanded="false"*/}
          {/*  aria-label="Toggle side panel"*/}
          {/*>*/}
          {/*  <div className="dropdown-marble">*/}
          {/*    <img*/}
          {/*      src={assetRootPath('/images/bell-icon.svg')}*/}
          {/*      alt="Activity menu"*/}
          {/*    />*/}
          {/*  </div>*/}
          {/*</button>*/}
          <IPFSDappLink css="d-lg-none" />
          {<AccountStatusPopover />}
          {!active && !account && (
            <div className="d-flex d-md-none">
              <GetOUSD
                navMarble
                connect={true}
                trackSource="Mobile navigation"
                style={{ marginLeft: 10 }}
              />
            </div>
          )}
          {/*<div*/}
          {/*  className="primarySidePanel dark-background collapse"*/}
          {/*  data-toggle="collapse"*/}
          {/*  data-target=".primarySidePanel"*/}
          {/*  aria-controls="primarySidePanel"*/}
          {/*/>*/}
          <div
            className="navLinks dark-background collapse"
            data-toggle="collapse"
            data-target=".navLinks"
            aria-controls="navLinks"
          />
          <div
            className="langLinks dark-background collapse"
            data-toggle="collapse"
            data-target=".langLinks"
            aria-controls="langLinks"
          />
          <div className="langLinks collapse navbar-collapse justify-content-end lang-opts">
            <button
              className="close navbar-toggler"
              type="button"
              data-toggle="collapse"
              data-target=".langLinks"
              aria-controls="langLinks"
              aria-expanded="false"
              aria-label="Toggle language navigation"
            >
              <img
                src={assetRootPath('/images/close.svg')}
                alt="Close icon"
                loading="lazy"
              />
            </button>
            <LanguageOptions locale={locale} onLocale={onLocale} />
          </div>
          <div
            className={
              'navLinks collapse navbar-collapse justify-content-end flex-column flex-lg-row d-flex'
            }
          >
            <button
              className="close navbar-toggler"
              type="button"
              data-toggle="collapse"
              data-target=".navLinks"
              aria-controls="navLinks"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <img
                src={assetRootPath('/images/close.svg')}
                alt="Close icon"
                loading="lazy"
              />
            </button>
            <div className="d-flex flex-column flex-lg-row mb-auto w-100 align-items-center">
              <DappLinks page={page} />
              {environment !== 'production' && (
                <ul className="navbar-nav">
                  <li className="nav-item mr-2">
                    <Link href={adjustLinkHref('/dashboard')}>
                      <a>{fbt('Debug', 'Debugging dashboard link')}</a>
                    </Link>
                  </li>
                </ul>
              )}
              <IPFSDappLink css="d-none d-lg-block" />
              <div className={`d-flex flex-column flex-lg-row-reverse`}>
                <AccountStatusDropdown />
              </div>
              {active && account && (
                <div className="d-flex">
                  <TransactionActivityDropdown />
                </div>
              )}
              <GetOUSD
                style={{ marginTop: 40 }}
                className="mt-auto d-lg-none"
                light2
                trackSource="Mobile navigation menu"
              />
            </div>
          </div>
        </div>
        <div className="d-flex d-lg-none">
          <DappLinks page={page} />
        </div>
      </nav>
      <style jsx>{`
        .banner {
          background-color: transparent;
          font-size: 0.8125rem;
          height: 40px;
          position: absolute;
          margin-top: 35px;
          top: -40px;
          background-color: red;
          width: 100%;
          z-index: 3;
          display: flex;
        }
        .banner:not(.dapp) {
          background-color: #2f424e;
        }
        .banner.dapp {
          border-radius: 5px;
          border: solid 1px #fec100;
          color: #fec100;
        }

        .banner.burn {
          background-color: #141519;
          border: solid 1px;
          border-radius: 5px;
        }

        .banner.burn .triangle {
          top: 8px;
          border-top: 6px solid transparent;
          border-right: 8px solid white;
          border-bottom: 6px solid transparent;
        }

        .navbar-brand {
          min-height: 40px;
        }

        .navbar {
          padding: 35px 0 0 0;
          font-size: 0.8125rem;
          margin-top: 0;
          z-index: 2;
        }
        .navbar a {
          color: #fafbfb;
          text-decoration: none;
        }
        .navbar a:hover {
          opacity: 0.8;
        }
        .navbar .container {
          margin-top: 30px;
        }
        .navbar-toggler {
          margin-left: 10px;
          padding-left: 0;
          padding-right: 0;
        }
        .navbar-toggler:focus {
          border-color: transparent;
          outline: none;
          opacity: 0.8;
        }
        .nav-item {
          align-items: center;
          display: flex;
          margin-right: 31px;
        }
        .debug {
          position: absolute;
          top: 0;
          right: 0;
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

        .navLinks {
          z-index: 4;
        }

        .nav-coin-icon {
          width: 16px;
          height: 16px;
          margin-right: 6px;
        }

        .ousd-experimental-notice {
          width: 100%;
          margin-top: 44px;
          padding: 13px 22px;
          border-radius: 10px;
          border: solid 1px #fec100;
          font-size: 16px;
          line-height: 1.44;
          color: #fec100;
        }

        .learn-more {
          font-size: 16px;
          font-weight: bold;
          color: white !important;
        }

        .linky-thing {
          width: 12px;
          height: 12px;
        }

        @media (max-width: 992px) {
          .container {
            width: 100%;
            max-width: 100%;
            padding-left: 30px;
            padding-right: 30px;
          }
          .navbar-collapse {
            background: white;
            font-size: 1.5rem;
            position: fixed;
            left: 100%;
            padding: 74px 30px;
            height: 9999px;
            width: 256px;
            transition: all 0.3s ease;
            display: block;
            top: 0;
          }
          .navbar-collapse.collapsing {
            transition: all 0.3s ease;
            display: block;
          }
          .navbar-collapse.show {
            left: calc(100% - 256px);
          }
          .navbar a {
            color: black;
          }

          .close {
            background: none;
            border: none;
            position: absolute;
            top: 30px;
            right: 30px;
          }

          ul {
            position: relative;
            left: -15px;
            width: calc(100% + 30px);
          }

          .nav-item {
            font-size: 1.5rem;
            margin: 0 0 28px;
          }

          .nav-item.active {
            border-left: 5px solid #1a82ff;
          }

          .nav-item:not(.active) {
            border-left: 5px solid white;
          }

          .nav-item .nav-link {
            line-height: 1;
            padding: 2px 0 2px 30px;
          }

          div.dropdown-marble {
            border-color: #fafbfb;
            height: 24px;
            width: 24px;
          }

          .navLinks {
            height: 100vh !important;
            padding-bottom: 30px !important;
          }
        }

        @media (max-width: 992px) {
          .origin-logo {
            max-width: 170px;
          }

          .banner {
            display: none;
          }

          .navbar .container {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .ousd-experimental-notice {
            margin: 0px 20px 20px 20px;
            width: auto;
          }

          .ousd-experimental-notice {
            padding: 13px 28px;
          }

          .learn-more {
            margin-top: 5px;
          }
        }

        @media (min-width: 992px) {
          .navbar .nav-link {
            border: 1px solid transparent;
            padding-left: 0;
            padding-right: 0;
          }

          .navbar .nav-link:hover,
          .navbar .active .nav-link {
            border-bottom-color: #fafbfb;
            opacity: 1;
          }

          .langLinks {
            display: none !important;
          }
        }

        @media (max-width: 1199px) {
          .banner.dapp {
            left: 0;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
            border-top: 0;
          }
        }

        @media (min-width: 1200px) {
          .triangle {
            position: absolute;
            top: 10px;
            left: -8px;
            width: 0;
            height: 0;
            border-top: 6px solid transparent;
            border-right: 8px solid #2f424e;
            border-bottom: 6px solid transparent;
          }
          .banner {
            border-radius: 2px;
            top: 34px;
            height: 32px;
            padding: 0 15px;
            width: initial;
          }
          .banner:not(.dapp) {
            left: 430px;
          }

          .navbar {
            margin-top: 0;
          }
        }

        @media (max-width: 992px) {
          .navbar {
            z-index: 100;
          }

          .navbar .container {
            margin: 1.5rem 0;
            padding: 0 30px;
          }

          .lang-opts {
            z-index: 1000;
          }
        }

        @media (min-width: 1200px) {
          .banner {
            left: 50%;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(Nav)
