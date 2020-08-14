import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { withRouter } from 'react-router-dom'
import { useStoreState } from 'pullstate'

import withIsMobile from 'hoc/withIsMobile'
import Link from 'components/Link'
import NavLink from 'components/NavLink'
import AccountStatus from 'components/AccountStatus'
import LocaleDropdown from 'components/LocaleDropdown'

const Nav = ({ isMobile, locale, onLocale }) => {
  return (
    <nav className="navbar">
      <div className="container px-0 d-flex justify-content-between">
        <div className="logo d-flex">
          <Link to="/" className="navbar-brand d-flex">
            Origin
          </Link>
          TREASURY
        </div>
        <div className="d-flex">
          <Link
            className="mr-4"
            to="/dashboard"
          >
            Debug Dashboard 
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
  )
}

export default withRouter(withIsMobile(Nav))

require('react-styl')(`
  .navbar
    padding: 0
    .container
      margin-top: 30px
  .navbar-brand
    background: url(images/origin-logo-black.svg) no-repeat center
    background-size: 100%
    width: 90px
    text-indent: -9999px
  .logo
    color: #1a82ff
    font-size: 30px
    font-weight: 900
  .dropdown-marble
    border-radius: 15px
    border: solid 1px #cdd7e0
    background-color: #1a82ff
    display: flex
    justify-content: center
    align-items: center
    width: 30px
    height: 30px
    padding: 0
    color: white
    &.active
      background-color: #1e313f
    &.selected
      background-color: transparent
      &.show
        background-color: #1e313f
  .dropdown
    a
      .dropdown-selected
        color: #8293a4
        font-size: 14px
        &.open
          color: #fafbfc
    .dropdown-menu
      right: 0
      left: auto
      top: 135%
      border-radius: 10px
      box-shadow: 0 0 34px 0 #cdd7e0
      border: solid 1px #cdd7e0
      background-color: #ffffff
      padding: 20px 30px 20px 20px
      min-width: 170px
      .dropdown-marble
        margin-right: 18px
      a:not(:last-child)
        > div
          margin-bottom: 10px
      a
        color: #1e313f
        .active
          font-weight: bold;
          .dropdown-marble
            background-color: #1e313f
`)
