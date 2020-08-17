import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'

import withIsMobile from 'hoc/withIsMobile'
import Link from 'next/link'
import AccountStatus from 'components/AccountStatus'
import LocaleDropdown from 'components/LocaleDropdown'

const DappNav = ({ isMobile, locale, onLocale }) => {
  return (
    <div>
      <nav className="navbar">
        <div className="container px-0 d-flex justify-content-between">
          <div className="dapp-logo d-flex">
            <Link href="/">
              <a className="navbar-brand d-flex">
                Origin
              </a>
            </Link>
            TREASURY
          </div>
          <div className="d-flex">
            <Link
              href="/dapp/dashboard"
            >
              <a className="mr-4">Debug Dashboard</a>
            </Link>
            <LocaleDropdown
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
      </nav>
      <style jsx>{`
        .navbar {
          padding: 0;
        }
        .navbar .container {
          margin-top: 30px;
        }
        .navbar-brand {
          background: url(/images/origin-logo-black.svg) no-repeat center;
          background-size: 100%;
          width: 90px;
          text-indent: -9999px;
        }
        .dapp-logo {
          color: #1a82ff;
          font-size: 30px;
          font-weight: 900;
        }
      `}</style>
    </div>
  )
}

export default withIsMobile(DappNav)
