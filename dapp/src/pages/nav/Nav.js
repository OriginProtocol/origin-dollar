import React, { useState, useEffect } from 'react'
import { withRouter } from 'react-router-dom'
import withIsMobile from 'hoc/withIsMobile'

import Link from 'components/Link'
import NavLink from 'components/NavLink'

import { useStoreState } from 'pullstate'
import { UIStore } from 'stores/UIStore'

const Nav = ({ isMobile }) => {
  const isDarkMode = useStoreState(UIStore, s => s.isDarkMode)
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
      <div
        onClick={() =>
          UIStore.update(s => {
            s.isDarkMode = !isDarkMode
          })
        }
      ></div>
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
