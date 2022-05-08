import React from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import { useWeb3React } from '@web3-react/core'

import withIsMobile from 'hoc/withIsMobile'

import GetOUSD from 'components/GetOUSD'
import AccountStatusDropdown from 'components/AccountStatusDropdown'
import { formatCurrency } from 'utils/math'
import { getDocsLink } from 'utils/getDocsLink'
import LanguageOptions from 'components/LanguageOptions'
import LanguageSelected from 'components/LanguageSelected'
import LocaleDropdown from 'components/LocaleDropdown'
import OusdDropdown from 'components/earn/OusdDropdown'
import OgnDropdown from 'components/earn/OgnDropdown'
import IPFSDappLink from 'components/IPFSDappLink'
import ContractStore from 'stores/ContractStore'
import AccountStore from 'stores/AccountStore'

import Languages from '../constants/Languages'
import AccountStatusPopover from './AccountStatusPopover'
import { adjustLinkHref } from 'utils/utils'
import { assetRootPath } from 'utils/image'

const environment = process.env.NODE_ENV
const showExperimentalSoftwareNotice = false
const DappLinks = ({ dapp, page }) => {
  const ousdBalance = useStoreState(AccountStore, (s) => s.balances['ousd'])
  const lifetimeYield = useStoreState(AccountStore, (s) => s.lifetimeYield)

  return (
    <>
      {dapp && (
        <div className="d-flex align-items-center justify-content-center dapp-navigation mr-auto flex-wrap">
          {(process.env.ENABLE_LIQUIDITY_MINING === 'true' ||
            process.env.ENABLE_STAKING === 'true') && (
            <Link href={adjustLinkHref('/swap')}>
              <a
                className={`d-flex align-items-center ml-md-0 ${
                  page === 'swap' ? 'selected' : ''
                }`}
              >
                {fbt('Swap OUSD', 'Swap OUSD')}
              </a>
            </Link>
          )}
          {process.env.ENABLE_LIQUIDITY_MINING === 'true' && (
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
          {process.env.ENABLE_STAKING === 'true' && (
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
      )}
      <style jsx>{`
        .dapp-navigation {
          font-family: Lato;
          font-size: 14px;
          color: white;
          margin-left: 25px;
        }

        .dapp-navigation a {
          padding: 6px 4px;
          margin-left: 8px;
          margin-right: 8px;
          white-space: nowrap;
          margin-bottom: 1px;
        }

        .dapp-navigation a.selected {
          border-bottom: solid 1px white;
          margin-bottom: 0px;
          font-weight: bold;
        }

        @media (max-width: 799px) {
          .dapp-navigation {
            margin-top: -10px;
            margin-left: 0px;
            margin-bottom: 5px;
          }

          .dapp-navigation a {
            margin-left: 24px;
            margin-right: 24px;
          }
        }
      `}</style>
    </>
  )
}

const Nav = ({ dapp, isMobile, locale, onLocale, page }) => {
  const { pathname } = useRouter()
  const { active, account } = useWeb3React()
  const apy = useStoreState(ContractStore, (s) => s.apy.apy365 || 0)

  return (
    <>
      {!dapp && (
        <div
          className={classnames(
            'banner align-items-center justify-content-center',
            { dapp }
          )}
        >
          <div className="triangle d-none d-xl-block"></div>
          {fbt(
            `Trailing 365-day APY: ${fbt.param(
              'APY',
              formatCurrency(apy * 100, 2) + '%'
            )}`,
            'Current APY banner'
          )}
        </div>
      )}
      <nav
        className={classnames(
          'navbar navbar-expand-lg d-flex justify-content-center flex-column',
          { dapp }
        )}
      >
        <div className="container p-lg-0 flex-nowrap">
          <Link href={adjustLinkHref('/')}>
            <a className="navbar-brand d-flex flex-column justify-content-center">
              <img
                src={assetRootPath('/images/origin-dollar-logo.svg')}
                className="origin-logo"
                alt="Origin Dollar logo"
              />
            </a>
          </Link>
          {dapp && (
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
          )}
          <button
            className={`navbar-toggler ${!dapp ? 'ml-auto' : ''}`}
            type="button"
            data-toggle="collapse"
            data-target=".langLinks"
            aria-controls="langLinks"
            aria-expanded="false"
            aria-label="Toggle language navigation"
          >
            <div className="dropdown-marble">
              <LanguageSelected locale={locale} />
            </div>
          </button>
          <IPFSDappLink dapp={dapp} css="d-lg-none" />
          {!dapp && (
            <button
              className="navbar-toggler d-lg-none ml-4"
              type="button"
              data-toggle="collapse"
              data-target=".navLinks"
              aria-controls="navLinks"
              aria-expanded="false"
              aria-label="Toggle menu side panel"
            >
              <img
                src={assetRootPath('/images/menu-icon.svg')}
                alt="Activity menu"
              />
            </button>
          )}
          {dapp && <AccountStatusPopover />}
          {dapp && !active && !account && (
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
          <div className="navLinks collapse navbar-collapse justify-content-end flex-column flex-lg-row d-flex">
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
            <div className="d-flex w-100 align-items-center">
              {!dapp && (
                <ul className={`navbar-nav ${!dapp ? 'ml-auto' : ''}`}>
                  <li
                    className={classnames('nav-item', {
                      active: pathname === '/',
                    })}
                  >
                    <Link href={adjustLinkHref('/')}>
                      <a className="nav-link">
                        {fbt('Home', 'Home page link')}{' '}
                        <span className="sr-only">(current)</span>
                      </a>
                    </Link>
                  </li>
                  <li
                    className={classnames('nav-item', {
                      active: pathname === '/earn-info',
                    })}
                  >
                    <Link href={adjustLinkHref('/earn-info')}>
                      <a className="nav-link">
                        {fbt('Earn', 'Earn info page link')}
                      </a>
                    </Link>
                  </li>
                  <li
                    className={classnames('nav-item', {
                      active: pathname === '/governance',
                    })}
                  >
                    <Link href={adjustLinkHref('/governance')}>
                      <a className="nav-link">
                        {fbt('Governance', 'Governance page link')}
                      </a>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <a
                      href={getDocsLink(locale)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-link"
                    >
                      {fbt('Docs', 'Documentation link')}
                    </a>
                  </li>
                </ul>
              )}
              <DappLinks dapp={dapp} page={page} />
              {dapp && environment !== 'production' && (
                <ul className="navbar-nav">
                  <li className="nav-item mr-2">
                    <Link href={adjustLinkHref('/dashboard')}>
                      <a>{fbt('Debug', 'Debugging dashboard link')}</a>
                    </Link>
                  </li>
                </ul>
              )}
              <IPFSDappLink dapp={dapp} css="d-none d-lg-block" />
              <div
                className={`d-flex flex-column ${
                  dapp ? 'flex-lg-row-reverse' : 'flex-lg-row'
                }`}
              >
                {!dapp && (
                  <LocaleDropdown
                    locale={locale}
                    onLocale={onLocale}
                    outerClassName={`${dapp ? 'ml-2' : ''}`}
                    className="nav-dropdown"
                    useNativeSelectbox={false}
                  />
                )}
                <AccountStatusDropdown
                  dapp={dapp}
                  className={dapp ? '' : 'ml-2'}
                />
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
        <div className="d-flex d-md-none">
          <DappLinks dapp={dapp} page={page} />
        </div>
      </nav>
      <style jsx>{`
        .banner {
          background-color: transparent;
          font-size: 0.8125rem;
          height: 40px;
          position: absolute;
          top: -40px;
          width: 100%;
          z-index: 1;
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

        .navbar-brand {
          min-height: 40px;
        }

        .navbar {
          padding: 0;
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

        @media (max-width: 799px) {
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
            left: calc((100vw - 940px) / 2 + 337px);
          }

          .navbar {
            margin-top: 0;
          }
        }

        @media (max-width: 799px) {
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
