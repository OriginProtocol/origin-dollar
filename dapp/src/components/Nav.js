import React from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { fbt } from 'fbt-runtime'
import { useAccount } from 'wagmi'
import dynamic from 'next/dynamic'
import withIsMobile from 'hoc/withIsMobile'
import LanguageOptions from 'components/LanguageOptions'
import IPFSDappLink from 'components/IPFSDappLink'
import { adjustLinkHref } from 'utils/utils'
import { assetRootPath } from 'utils/image'

const environment = process.env.NODE_ENV

const GetOUSD = dynamic(() => import('components/GetOUSD'), {
  ssr: false,
})

const AccountStatusDropdown = dynamic(
  () => import('components/AccountStatusDropdown'),
  {
    ssr: false,
  }
)

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
            {fbt('Swap OUSD', 'Swap OUSD')}
          </a>
        </Link>
        {process.env.NEXT_PUBLIC_ENABLE_LIQUIDITY_MINING === 'true' && (
          <Link href={adjustLinkHref('/earn')}>
            <a
              className={`d-flex align-items-center ${
                page === 'earn' || page === 'pool-details' ? 'selected' : ''
              }`}
            >
              {fbt('Earn OGN', 'Earn OGN')}
            </a>
          </Link>
        )}
        {process.env.NEXT_PUBLIC_ENABLE_STAKING === 'true' && (
          <Link href={adjustLinkHref('/earn')}>
            <a
              className={`d-flex align-items-center ${
                page === 'earn' ? 'selected' : ''
              }`}
            >
              {fbt('Earn OGN', 'Earn OGN')}
            </a>
          </Link>
        )}
        <Link href={adjustLinkHref('/wrap')}>
          <a
            className={`d-flex align-items-center ${
              page === 'wrap' ? 'selected' : ''
            }`}
          >
            {fbt('Wrap OUSD', 'Wrap OUSD')}
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
          font-family: Lato;
          font-size: 14px;
          color: white;
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

const Nav = ({ locale, onLocale, page }) => {
  const { address: account, isConnected: active } = useAccount()

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
                src={assetRootPath('/images/origin-dollar-logo.svg')}
                className="origin-logo"
                alt="Origin Dollar logo"
              />
            </a>
          </Link>
          <button
            className="navbar-toggler d-lg-none ml-auto"
            type="button"
            data-toggle="collapse"
            data-target=".primarySidePanel"
            aria-controls="primarySidePanel"
            aria-expanded="false"
            aria-label="Toggle side panel"
          >
            <div className="dropdown-marble">
              <img
                src={assetRootPath('/images/bell-icon.svg')}
                alt="Activity menu"
              />
            </div>
          </button>
          <IPFSDappLink css="d-lg-none" />
          <AccountStatusDropdown />
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
          <div
            className="primarySidePanel dark-background collapse"
            data-toggle="collapse"
            data-target=".primarySidePanel"
            aria-controls="primarySidePanel"
          />
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
          color: white;
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
            border-color: white;
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
            border-bottom-color: white;
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
