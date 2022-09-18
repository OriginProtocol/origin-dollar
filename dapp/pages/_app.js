import React, { useEffect, useState } from 'react'
import cookies from 'next-cookies'
import { useWeb3React } from '@web3-react/core'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useStoreState } from 'pullstate'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'

import AccountStore from 'stores/AccountStore'
import RouterStore from 'stores/RouterStore'
import AccountListener from 'components/AccountListener'
import UserActivityListener from 'components/UserActivityListener'
import TransactionListener from 'components/TransactionListener'
import withWeb3Provider from 'hoc/withWeb3Provider'
import setUtilLocale from 'utils/setLocale'
import { setUserSource } from 'utils/user'
import { useEagerConnect } from 'utils/hooks'
import { logout, login } from 'utils/account'
import WalletSelectModal from 'components/WalletSelectModal'
import { ToastContainer } from 'react-toastify'
import { getConnector, getConnectorImage } from 'utils/connectors'

import analytics from 'utils/analytics'
import { AnalyticsProvider } from 'use-analytics'
import { initSentry } from 'utils/sentry'

import 'react-toastify/scss/main.scss'
import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'

let VConsole, ReactPixel
if (process.browser && process.env.NODE_ENV === 'development') {
  VConsole = require('vconsole/dist/vconsole.min.js')
}
if (process.browser) {
  ReactPixel = require('react-facebook-pixel').default
}

initSentry()

const queryClient = new QueryClient()

function App({ Component, pageProps, err }) {
  const [locale, setLocale] = useState('en_US')

  const {
    connector,
    library,
    chainId,
    account,
    activate,
    deactivate,
    active,
    error,
  } = useWeb3React()
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const router = useRouter()
  const tried = useEagerConnect()
  const address = useStoreState(AccountStore, (s) => s.address)

  if (process.browser) {
    useEffect(() => {
      router.events.on('routeChangeComplete', (url) => {
        RouterStore.update((s) => {
          s.history = [...RouterStore.currentState.history, url]
        })
      })
    }, [])
  }

  useEffect(() => {
    // Update account info when connection already established
    if (tried && active && (!account || account !== address)) {
      login(account, setCookie)
    }
  }, [active, tried, account])

  useEffect(() => {
    if (error) {
      alert(error)
      console.log(error)
    }

    if (process.browser && process.env.NODE_ENV === 'development') {
      var vConsole = new VConsole()
    }
  }, [])

  useEffect(() => {
    if (!process.browser) return

    const options = {
      autoConfig: true,
      debug: process.env.NODE_ENV === 'development',
    }

    ReactPixel.init('1106573693417404', {}, options)
    ReactPixel.pageView()
  }, [process.browser])

  useEffect(() => {
    if (localStorage.locale) {
      setLocale(localStorage.locale)
      setUtilLocale(localStorage.locale, true)
    }
  }, [])

  const trackPageView = (url, lastURL) => {
    const data = {
      toURL: url,
    }

    if (lastURL) {
      data.fromURL = lastURL
    }

    analytics.page(data)

    if (url.indexOf('?') > 0) {
      const searchParams = new URLSearchParams(url.substr(url.indexOf('?') + 1))
      const utmSource = searchParams.get('utm_source')
      if (utmSource) {
        setUserSource(utmSource)
      }
    } else {
      /* if first page load is not equipped with the 'utm_source' we permanently mark
       * user source as unknown
       */
      setUserSource('unknown')
    }
  }

  useEffect(() => {
    let lastURL = window.location.pathname + window.location.search

    // track initial page load
    trackPageView(lastURL)

    const handleRouteChange = (url) => {
      /* There is this weird behaviour with react router where `routeChangeComplete` gets triggered
       * on initial load only if URL contains search parameters. And without this check and search
       * parameters present the inital page view would be tracked twice.
       */
      if (url === lastURL) {
        return
      }
      // track when user navigates to a new page
      trackPageView(url, lastURL)
      lastURL = url
    }

    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])

  const onLocale = async (newLocale) => {
    const locale = await setUtilLocale(newLocale)
    setLocale(locale)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <AnalyticsProvider instance={analytics}>
          <AccountListener />
          <TransactionListener />
          <UserActivityListener />
          <WalletSelectModal />
          <ToastContainer
            position="bottom-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            pauseOnHover
          />
          <Component
            locale={locale}
            onLocale={onLocale}
            {...pageProps}
            err={err}
          />
        </AnalyticsProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </>
  )
}

export default withWeb3Provider(App)
