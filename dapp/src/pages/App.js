import React, { useState, useEffect } from 'react'
import { Switch, Route, withRouter } from 'react-router-dom'
import { useEagerConnect } from '../hooks'

import get from 'lodash/get'

import withIsMobile from 'hoc/withIsMobile'
import Nav from './nav/Nav'
import Landing from './Landing'
import Dashboard from './Dashboard'
import AccountListener from 'components/AccountListener'

require('dotenv').config()

const App = ({ location, isMobile, locale, onLocale }) => {
  const [hasError, setHasError] = useState(false)
  const [showFooter, setShowFooter] = useState(true)

  useEagerConnect()

  useEffect(() => {
    if (get(location, 'state.scrollToTop')) {
      window.scrollTo(0, 0)
    }
  }, [location])

  if (hasError) {
    return (
      <div className="app-spinner">
        <h5>Error!</h5>
        <div>Please refresh the page</div>
      </div>
    )
  }

  return (
    <div className="container">
      <Nav
        onShowFooter={() => setShowFooter(true)}
        locale={locale}
        onLocale={onLocale}
      />
      <main>
        <AccountListener />
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route component={Landing} /> 
        </Switch>
      </main>
    </div>
  )
}

export default withIsMobile(withRouter(App))

require('react-styl')(`
  body
    background-color: #fafbfc
  .app-spinner
    position: fixed
    top: 50%
    left: 50%
    text-align: center
    transform: translate(-50%, -50%)
  main
    display: flex
    flex-direction: column
  #app
    display: flex
    flex-direction: column
`)
