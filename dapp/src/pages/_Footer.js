import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import Link from 'components/Link'
import withIsMobile from 'hoc/withIsMobile'

const Footer = ({ isMobile }) => {
  return (
    <div className="footer-wrapper">
      <footer></footer>
    </div>
  )
}

export default withRouter(withIsMobile(Footer))

require('react-styl')(`
  .footer-wrapper
    footer
      position: fixed
      bottom: 0px
      right: 0
      left: 0
      transition: bottom 0.3s ease
      z-index: 500
      box-shadow: 0 -1px 2px 0 rgba(0, 0, 0, 0.1)
      background-color: var(--white)
      padding: 2.5rem 2rem
      font-size: 12px
      color: var(--dark-grey-blue)
      min-height: 22rem

  @media (max-width: 767.98px)
    .footer-wrapper
      .footer-action-button
        bottom: 10px
        right: 10px
      footer
        min-height: auto
`)
