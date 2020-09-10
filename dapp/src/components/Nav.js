import React from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import withIsMobile from 'hoc/withIsMobile'

import AccountStatusDropdown from 'components/AccountStatusDropdown'
import { formatCurrency } from 'utils/math'
import LanguageOptions from 'components/LanguageOptions'
import LanguageSelected from 'components/LanguageSelected'
import LocaleDropdown from 'components/LocaleDropdown'
import ContractStore from 'stores/ContractStore'

import Languages from '../constants/Languages'
import AccountStatusPopover from './AccountStatusPopover'

const docsURL = process.env.DOCS_URL
const launched = process.env.LAUNCHED
const environment = process.env.NODE_ENV

const Nav = ({ dapp, isMobile, locale, onLocale }) => {
  const { pathname } = useRouter()
  const apy = launched
    ? useStoreState(ContractStore, (s) => s.apr || 0)
    : 0.1234

  return (
    <>
      {!dapp && <div className="triangle d-none d-xl-block"></div>}
      <div
        className={classnames(
          'banner d-flex align-items-center justify-content-center',
          { dapp }
        )}
      >
        {dapp
          ? fbt(
              'This project is in Beta. Use at your own risk.',
              'Beta warning'
            )
          : fbt(
              `Currently earning ${fbt.param(
                'APY',
                formatCurrency(apy * 100) + '%'
              )} APY`,
              'Current APY banner'
            )}
      </div>
      <nav className={classnames('navbar navbar-expand-lg', { dapp })}>
        <div className="container p-lg-0">
          <Link href={dapp ? '/dapp' : '/'}>
            <a className="navbar-brand d-flex flex-columm">
              <img
                src="/images/origin-dollar-logo.svg"
                alt="Origin Dollar logo"
              />
            </a>
          </Link>
          <button
            className="navbar-toggler d-md-none ml-auto"
            type="button"
            data-toggle="collapse"
            data-target=".primarySidePanel"
            aria-controls="primarySidePanel"
            aria-expanded="false"
            aria-label="Toggle side panel"
          >
            <div className="dropdown-marble">
              <img src="/images/bell-icon.svg" alt="Activity menu" />
            </div>
          </button>
          <button
            className="navbar-toggler"
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
          <AccountStatusPopover />
          <div
            className="primarySidePanel dark-background collapse"
            data-toggle="collapse"
            data-target=".primarySidePanel"
            aria-controls="primarySidePanel"
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
              <img src="/images/close.svg" alt="Close icon" loading="lazy" />
            </button>
            <LanguageOptions locale={locale} onLocale={onLocale} />
          </div>
          <div className="navLinks collapse navbar-collapse justify-content-end">
            <button
              className="close navbar-toggler"
              type="button"
              data-toggle="collapse"
              data-target=".navLinks"
              aria-controls="navLinks"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <img src="/images/close.svg" alt="Close icon" loading="lazy" />
            </button>
            {!dapp && (
              <ul className="navbar-nav">
                <li
                  className={classnames('nav-item', {
                    active: pathname === '/',
                  })}
                >
                  <Link href="/">
                    <a className="nav-link">
                      {fbt('Home', 'Home page link')}{' '}
                      <span className="sr-only">(current)</span>
                    </a>
                  </Link>
                </li>
                <li
                  className={classnames('nav-item', {
                    active: pathname === '/earn',
                  })}
                >
                  <Link href="/earn">
                    <a className="nav-link">{fbt('Earn', 'Earn page link')}</a>
                  </Link>
                </li>
                <li
                  className={classnames('nav-item', {
                    active: pathname === '/governance',
                  })}
                >
                  <Link href="/governance">
                    <a className="nav-link">
                      {fbt('Governance', 'Governance page link')}
                    </a>
                  </Link>
                </li>
                <li className="nav-item">
                  <a
                    href={docsURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                  >
                    {fbt('Docs', 'Documentation link')}
                  </a>
                </li>
              </ul>
            )}
            {dapp && environment !== 'production' && (
              <ul className="navbar-nav">
                <li className="nav-item mr-2">
                  <Link href="/dapp/dashboard">
                    <a>{fbt('Debug', 'Debugging dashboard link')}</a>
                  </Link>
                </li>
              </ul>
            )}
            <div className="d-flex flex-column flex-lg-row">
              <LocaleDropdown
                locale={locale}
                onLocale={onLocale}
                className="nav-dropdown"
                useNativeSelectbox={false}
              />
              {launched && <AccountStatusDropdown className="ml-2" />}
              {!launched && (
                <a
                  href={docsURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn learn-more"
                >
                  {fbt('Learn More', 'Learn more button')}
                </a>
              )}
            </div>
          </div>
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
        .learn-more {
          border-radius: 16px;
          border: solid 1px white;
          color: white;
          font-size: 0.8125rem;
          margin-left: 10px;
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

        @media (max-width: 992px) {
          .container {
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
            left: -30px;
            width: calc(100% + 30px);
          }

          .nav-item {
            font-size: 1.5rem;
            margin: 0 0 28px;
          }

          .nav-item.active {
            border-left: 5px solid black;
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

          .navbar {
            margin-top: 40px;
          }
        }

        @media (min-width: 1200px) {
          .triangle {
            position: absolute;
            top: 45px;
            left: calc((100vw - 940px) / 2 + 232px);
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
            padding: 0 10px;
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
