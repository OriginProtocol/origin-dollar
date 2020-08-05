import React, { useState, useEffect } from 'react'
import { withRouter } from 'react-router-dom'
import withIsMobile from 'hoc/withIsMobile'

import Link from 'components/Link'
import NavLink from 'components/NavLink'

const Nav = ({ isMobile }) => {
  const [open, setOpen] = useState()
  const navProps = nav => ({
    onOpen: () => setOpen(nav),
    onClose: () => open === nav && setOpen(false),
    open: open === nav
  })

  if (isMobile) {
    const canGoBack = history && history.length > 1
    return (
      <>
        <nav className={`navbar`}>
          <Link to="/" className="navbar-brand">
            Origin
          </Link>
        </nav>
      </>
    )
  }

  return (
    <nav className={`navbar navbar-expand-md`}>
      <Link to="/" className="navbar-brand">
        Origin
      </Link>
    </nav>
  )
}

export default withRouter(withIsMobile(Nav))

require('react-styl')(`
  .navbar
    padding: 0 1rem
  .navbar-brand
    background: url(images/origin-logo-black.svg) no-repeat center
    background-size: 100%
    width: 90px
    text-indent: -9999px

`)
