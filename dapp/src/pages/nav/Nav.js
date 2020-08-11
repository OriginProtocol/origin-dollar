import React, { useState, useEffect } from 'react'
import { withRouter } from 'react-router-dom'
import withIsMobile from 'hoc/withIsMobile'

import Link from 'components/Link'
import NavLink from 'components/NavLink'

import { useStoreState } from "pullstate"
import { AccountStore } from "stores/AccountStore"

const Nav = ({ isMobile }) => {
  //const isDarkMode = useStoreState(AccountStore, s => s.isDarkMode)
  return (
    <nav className="navbar">
      <div className="container d-flex justify-content-between">
        <div className="logo d-flex">
          <Link to="/" className="navbar-brand d-flex">
            Origin
          </Link>
          TREASURY
        </div>
        <div>
          asd
        </div>
      </div>
    </nav>
  )
}

export default withRouter(withIsMobile(Nav))

require('react-styl')(`
  .navbar
    padding: 0 1rem
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
`)
