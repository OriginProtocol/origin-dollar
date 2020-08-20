import React from 'react'
import classnames from 'classnames'
import Link from 'next/link'

import withIsMobile from 'hoc/withIsMobile'

import AccountStatus from 'components/AccountStatus'
import LocaleDropdown from 'components/LocaleDropdown'

const Nav = ({ dapp, isMobile, locale, onLocale }) => {
  return (
    <nav className={classnames('navbar navbar-expand-lg', { dapp })}>
      <div className="container p-lg-0">
        <Link href="/">
          <a className="navbar-brand">
            <img src={dapp ? '/images/ousd-logo-blue.svg' : '/images/ousd-logo.svg'} alt="Origin Dollar logo" loading="lazy" />
          </a>
        </Link>
        <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <img src={`/images/menu-icon-${dapp ? 'dark' : 'light'}.svg`} alt="Nav menu" loading="lazy" />
        </button>
        <div className="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
          {!dapp &&
            <ul className="navbar-nav">
              <li className="nav-item active">
                <Link href="/">
                  <a className="nav-link">Home <span className="sr-only">(current)</span></a>
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/earn">
                  <a className="nav-link">Earn Yields</a>
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/governance">
                  <a className="nav-link">Governance</a>
                </Link>
              </li>
              <li className="nav-item">
                <a href={process.env.DOCS_URL} target="_blank" rel="noopener noreferrer" className="nav-link">Docs</a>
              </li>
            </ul>
          }
          {dapp &&
            <ul className="navbar-nav">
              <li className="nav-item">
                <Link href="/dapp/dashboard">
                  <a>Debug Dashboard</a>
                </Link>
              </li>
            </ul>
          }
          <div className="d-flex flex-column flex-lg-row">
            <LocaleDropdown
              theme={dapp ? 'dark' : 'light'}
              locale={locale}
              onLocale={onLocale}
              className="nav-dropdown"
              useNativeSelectbox={false}
            />
            <AccountStatus
              className="ml-2"
            />
          </div>
        </div>
      </div>
      <style jsx>{`
        .navbar {
          padding: 0;
          font-size: 0.8125rem;
          z-index: 2;
        }
        .navbar:not(.dapp) a {
          color: white;
        }
        .navbar a {
          text-decoration: none;
        }
        .navbar a:hover {
          opacity: 0.8;
        }
        .navbar .container {
          margin-top: 30px;
        }
        .navbar-toggler:focus {
          border: none;
          outline: none;
          opacity: 0.8;
        }
        .nav-item {
          margin-right: 40px;
        }
        .debug {
          position: absolute;
          top: 0;
          right: 0;
        }
      `}</style>
    </nav>
  )
}

export default withIsMobile(Nav)
