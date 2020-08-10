import React, { useState, useEffect } from 'react'
import { Switch, Route, withRouter } from 'react-router-dom'
import get from 'lodash/get'

import withIsMobile from 'hoc/withIsMobile'

import Nav from './nav/Nav'
import Footer from './_Footer'
import Dashboard from './Dashboard'

const App = ({ location, isMobile }) => {
  const [hasError, setHasError] = useState(false)
  const [showFooter, setShowFooter] = useState(true)

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
      <Nav onShowFooter={() => setShowFooter(true)} />
      <main>
        <Switch>
          <Route path="/settings" component={() => <Onboard />} />
          <Route component={Dashboard} />
        </Switch>
      </main>
    </div>
  )
}

export default withIsMobile(withRouter(App))

require('react-styl')(`
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
