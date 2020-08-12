const appHash = process.env.GIT_COMMIT_HASH || 'marketplace'
// Ensure storage is cleared on each deploy
if (localStorage.appHash !== appHash) {
  /* Here we add exceptions we don't want to clear when app hash changes:
   * - none yet
   */
  let exceptions = []
  exceptions = exceptions
    .map((key) => ({ key, value: localStorage.getItem(key) }))
    .filter((localStorageEntry) => localStorageEntry.value !== null)
  localStorage.clear()
  exceptions.forEach((localStorageEntry) =>
    localStorage.setItem(localStorageEntry.key, localStorageEntry.value)
  )

  sessionStorage.clear()
  localStorage.appHash = appHash
}

import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { HashRouter } from 'react-router-dom'
import Styl from 'react-styl'
import { Web3ReactProvider } from '@web3-react/core'
import ethers from 'ethers'
import setLocale from 'utils/setLocale'

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

function getWeb3Library(provider, connector) {
  return new ethers.providers.Web3Provider(provider)
}

class AppWrapper extends Component {
  state = {
    ready: false,
    locale: null
  }

  async componentDidMount() {
    try {
      const locale = await setLocale()
      this.setState({ ready: true, locale })
    } catch (error) {
      console.error('Error setting up locale', error)
    }
  }

  onLocale = async newLocale => {
    const locale = await setLocale(newLocale)
    this.setState({ locale })
    window.scrollTo(0, 0)
  }

  render() {
    const { ready, locale } = this.state

    if (!ready) return null
    return (
      <HashRouter>
        <Analytics>
          <Web3ReactProvider getLibrary={getWeb3Library}>
            <App
              locale={locale}
              onLocale={this.onLocale}
            />
          </Web3ReactProvider>
        </Analytics>
      </HashRouter>
    )
  }
}

ReactDOM.render(
  <AppWrapper
    ref={(app) => {
      window.appComponent = app
    }}
  />,
  document.getElementById('app')
)

Styl.addStylesheet()
