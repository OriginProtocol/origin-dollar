import React, { useEffect, useState, useRef, useCallback } from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import dynamic from 'next/dynamic'
import withIsMobile from 'hoc/withIsMobile'
import LanguageOptions from 'components/LanguageOptions'
import IPFSDappLink from 'components/IPFSDappLink'
import { adjustLinkHref } from 'utils/utils'
import { assetRootPath } from 'utils/image'
import TransactionStore from 'stores/TransactionStore'
import { usePrevious } from 'utils/hooks'
import { useAccount } from 'wagmi'

const environment = process.env.NODE_ENV

const Dropdown = dynamic(() => import('components/Dropdown'), {
  ssr: false,
})

const GetOUSD = dynamic(() => import('components/GetOUSD'), {
  ssr: false,
})

const AccountStatusDropdown = dynamic(
  () => import('components/AccountStatusDropdown'),
  {
    ssr: false,
  }
)

const TransactionActivity = dynamic(
  () => import('components/transactionActivity/TransactionActivity'),
  {
    ssr: false,
  }
)

const DappLinks = ({ page }) => {
  return (
    <>
      <div className="d-flex align-items-center justify-content-center dapp-navigation flex-wrap">
        <div className={`link-contain ${page === 'swap' ? 'selected' : ''}`}>
          <Link href={adjustLinkHref('/')}>
            <a
              className={`d-flex align-items-center ml-md-0 ${
                page === 'swap' ? 'selected' : ''
              }`}
            >
              {fbt('Swap', 'Swap')}
            </a>
          </Link>
        </div>
        <div
          className={`link-contain last ${page === 'wrap' ? 'selected' : ''}`}
        >
          <Link href={adjustLinkHref('/wrap')}>
            <a
              className={`d-flex align-items-center ${
                page === 'wrap' ? 'selected' : ''
              }`}
            >
              {fbt('Wrap', 'Wrap')}
            </a>
          </Link>
        </div>
        <div className={`link-contain ${page === 'history' ? 'selected' : ''}`}>
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
      </div>{' '}
      <style jsx>{`
        .link-contain {
          font-size: 16px;
          border-radius: 56px;
        }

        .link-contain.last {
          margin-right: 0 !important;
        }

        .link-contain.selected {
          background: linear-gradient(90deg, #b361e6 -28.99%, #6a36fc 144.97%);
          padding: 1px;
        }

        .dapp-navigation {
          font-family: Inter;
          font-size: 14px;
          color: #828699;
          margin-left: 50px;
          background-color: #1e1f25;
          border-radius: 56px;
        }

        .dapp-navigation a {
          white-space: nowrap;
          padding: 8px 24px;
        }

        .dapp-navigation a.selected {
          background: #000000aa;
          color: #fafafb;
          padding: 8px 24px;
          border-radius: 56px;
        }

        @media (max-width: 992px) {
          .dapp-navigation {
            margin-top: 8px;
            margin-left: 0px;
            margin-bottom: 24px;
          }

          .dapp-navigation a {
            padding: 8px 16px;
            font-size: 12px;
          }

          .dapp-navigation a.selected {
            padding: 8px 16px;
            font-size: 12px;
          }
        }
      `}</style>
    </>
  )
}

const TransactionActivityDropdown = () => {
  const animationHash = useRef(null)
  const [open, setOpen] = useState(false)
  const transactions = useStoreState(TransactionStore, (s) => s.transactions)
  const prevTransactions = usePrevious(transactions)
  const [txHashesToAnimate, setTxHashesToAnimate] = useState([])
  const [sortedTransactions, setSortedTransactions] = useState([])

  useEffect(() => {
    // check which transactions have newly arrived
    if (transactions?.length > 0) {
      const prevTxHashes = prevTransactions?.map((tx) => tx.hash)

      setTxHashesToAnimate((prev) => [
        ...prev,
        ...transactions
          .filter((tx) => !prevTxHashes?.includes(tx.hash))
          .map((tx) => tx.hash),
      ])

      if (animationHash.current) {
        // Clear previous timeout and extend
        clearTimeout(animationHash.current)
      }

      // Empty out after ~15 seconds, a bit over last block avg time
      animationHash.current = setTimeout(() => {
        setTxHashesToAnimate([])
        animationHash.current = null
      }, 13000)
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
    setSortedTransactions(sortedTx)
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
                src={assetRootPath('/images/activity-pending.svg')}
                alt="Transaction activity pending"
              />
            ) : lastProcessedTransaction?.mined &&
              !lastProcessedTransaction?.isError ? (
              <img
                className="activity-icon "
                src={assetRootPath('/images/activity-success.svg')}
                alt="Transaction activity success"
              />
            ) : (
              <img
                className="activity-icon"
                src={assetRootPath('/images/activity-failed.svg')}
                alt="Transaction activity failed"
              />
            )
          ) : (
            <img
              className="activity-icon"
              src={assetRootPath('/images/activity.svg')}
              alt="Transaction activity button"
            />
          )}
        </button>
      </Dropdown>
      <style jsx>{`
        .activity-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: #1e1f25;
          box-shadow: 0px 27px 80px rgba(0, 0, 0, 0.07),
            0px 6.0308px 17.869px rgba(0, 0, 0, 0.0417275),
            0px 1.79553px 5.32008px rgba(0, 0, 0, 0.0282725);
          border-radius: 100px;
          margin-left: 10px;
          border: none;
        }

        .activity-icon {
          display: flex;
          flex-shrink: 0;
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

        @media (max-width: 992px) {
          .activity-toggle {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </>
  )
}

const useSticky = ({ defaultSticky = false, stickAt = 80 }) => {
  const [isSticky, setIsSticky] = useState(defaultSticky)
  const [fromTop, setFromTop] = useState(0)

  const elRef = useRef(null)

  const toggleSticky = useCallback(
    (e, { top, bottom }) => {
      if (top <= 0 && bottom > stickAt) {
        !isSticky && setIsSticky(true)
      } else {
        isSticky && setIsSticky(false)
      }
      if (document?.body) {
        setFromTop(document?.body.scrollTop)
      }
    },
    [isSticky]
  )

  useEffect(() => {
    const handleScroll = (e) => {
      if (elRef?.current) {
        toggleSticky(e, elRef.current.getBoundingClientRect())
      }
    }
    document.body.addEventListener('scroll', handleScroll)
    return () => {
      document.body.removeEventListener('scroll', handleScroll)
    }
  }, [toggleSticky])

  return [{ elRef, fromTop, isSticky }]
}

const Nav = ({ locale, onLocale, page }) => {
  const { address: account, isConnected: active } = useAccount()

  const [{ elRef, isSticky }] = useSticky({
    defaultSticky: false,
  })

  return (
    <>
      <nav
        ref={elRef}
        className={classnames(
          'navbar navbar-expand-lg d-flex justify-content-center flex-column',
          {
            sticky: isSticky,
          }
        )}
      >
        <div className="nav-container flex-nowrap">
          <Link href={adjustLinkHref('/')}>
            <a className="navbar-brand d-flex flex-column justify-content-center">
              <img
                src={assetRootPath('/images/origin-ether-logo.svg')}
                className="origin-logo"
                alt="OETH logo"
              />
            </a>
          </Link>
          <div className="d-flex">
            <IPFSDappLink css="d-lg-none" />
            {active && (
              <div className="d-lg-none">
                <AccountStatusDropdown />
              </div>
            )}
            {active && account && (
              <div className="d-flex d-lg-none">
                <TransactionActivityDropdown />
              </div>
            )}
            {!active && (
              <div className="d-flex d-lg-none">
                <GetOUSD
                  navMarble
                  connect={true}
                  trackSource="Mobile navigation"
                />
              </div>
            )}
          </div>
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
            <div className="d-flex flex-column flex-lg-row mb-auto w-100 justify-content-between align-items-center">
              <DappLinks page={page} />
              <div className="d-flex flex-row">
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
        </div>
      </nav>
      <div className="d-flex d-lg-none justify-content-center dapplinks-contain">
        <DappLinks page={page} />
      </div>
      <style jsx>{`
        .notice {
          background-color: #0074f0;
          margin-bottom: 0px;
        }

        .notice.burn {
          background: linear-gradient(90deg, #8c66fc -28.99%, #0274f1 144.97%);
        }

        .notice.staking {
          background-color: #1a82ff;
        }

        .notice.dapp {
          margin-bottom: 0px;
        }

        .notice.disclaimer {
          background-color: #ff4e4e;
        }

        .notice .btn {
          font-size: 12px;
          height: auto;
          padding: 5px 20px;
          background-color: #fafbfb;
          color: #02080d;
        }

        .navbar-contain {
          width: 100%;
          margin-top: 48px !important;
          margin-bottom: 72px !important;
          margin: 0 auto;
          padding: 0 136px;
          max-width: 1700px;
        }

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
          background-color: #1e1f25;
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

        .navbar-brand img {
          max-height: 24px;
          max-width: 180px;
        }

        .navbar {
          display: flex;
          align-items: center;
          padding: 0;
          font-size: 16px;
          font-weight: 500;
          margin-top: 0;
          padding: 0;
          z-index: 2;
          height: 100px;
        }

        .navbar.sticky {
          position: sticky;
          top: 0;
          background: #101113;
        }

        .navbar.lightBg {
          background: #1e1f25;
          display: block;
        }

        .navbar a {
          color: #fafbfb;
          text-decoration: none;
        }

        .navbar a:hover {
          opacity: 0.8;
        }

        .navbar .nav-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 100%;
          padding: 0 80px;
        }

        .navbar .container {
          margin: 0;
          width: 100%;
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
          .dapplinks-contain {
            width: 100%;
          }

          .container {
            width: 100%;
            max-width: 100%;
            padding-left: 30px;
            padding-right: 30px;
          }

          .navbar-contain {
            margin-top: 24px !important;
            margin-bottom: 24px !important;
            padding: 0 24px !important;
            align-items: center;
            justify-content: space-between;
          }

          .navbar {
            font-size: 12px;
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

          .navbar .nav-container {
            padding: 0 20px;
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
          .navbar-contain {
            padding: 0 56px;
          }

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
          .navbar-brand img {
            max-height: 16px;
            max-width: 120px;
          }

          .navbar {
            z-index: 100;
          }

          .navbar .nav-container {
            margin: 1.5rem 0;
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

        @media (max-width: 799px) {
          .navbar .nav-container {
            padding: 0 12px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(Nav)
