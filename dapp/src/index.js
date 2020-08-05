const appHash = process.env.GIT_COMMIT_HASH || 'marketplace'
// Ensure storage is cleared on each deploy
if (localStorage.appHash !== appHash) {
  /* Here we add exceptions we don't want to clear when app hash changes:
   * - none yet
   */
  let exceptions = []
  exceptions = exceptions
    .map(key => ({ key, value: localStorage.getItem(key) }))
    .filter(localStorageEntry => localStorageEntry.value !== null)
  localStorage.clear()
  exceptions.forEach(localStorageEntry =>
    localStorage.setItem(localStorageEntry.key, localStorageEntry.value)
  )

  sessionStorage.clear()
  localStorage.appHash = appHash
}

import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { HashRouter } from 'react-router-dom'
import Styl from 'react-styl'

import App from './pages/App'
import Analytics from './components/Analytics'
import './css/app.css'

if (process.env.NODE_ENV === 'production') {
  try {
    require('../public/app.css')
  } catch (e) {
    console.warn('No built CSS found')
  }
}

class AppWrapper extends Component {
  state = {
    ready: true
  }

  render() {
    const { ready } = this.state

    if (!ready) return null
    return (
      <HashRouter>
        <Analytics>
          <App />
        </Analytics>
      </HashRouter>
    )
  }
}

ReactDOM.render(
  <AppWrapper
    ref={app => {
      window.appComponent = app
    }}
  />,
  document.getElementById('app')
)

Styl.addStylesheet()
