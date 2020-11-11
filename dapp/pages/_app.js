import React, { useEffect, useState } from 'react'
import cookies from 'next-cookies'
import { useWeb3React } from '@web3-react/core'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useStoreState } from 'pullstate'

import AccountStore from 'stores/AccountStore'
import AccountListener from 'components/AccountListener'
import UserActivityListener from 'components/UserActivityListener'
import TransactionListener from 'components/TransactionListener'
import withWeb3Provider from 'hoc/withWeb3Provider'
import setUtilLocale from 'utils/setLocale'
import { useEagerConnect } from 'utils/hooks'
import { logout, login } from 'utils/account'
import LoginModal from 'components/LoginModal'
import { ToastContainer } from 'react-toastify'
import { getConnector, getConnectorImage } from 'utils/connectors'

import mixpanel from 'utils/mixpanel'
import { initSentry } from 'utils/sentry'

import 'react-toastify/scss/main.scss'
import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'

let VConsole
if (process.browser && process.env.NODE_ENV === 'development') {
  VConsole = require('vconsole/dist/vconsole.min.js') 
}

initSentry()

function App({ Component, pageProps, err }) {
	const [locale, setLocale] = useState('en_US')

  const { connector, library, chainId, account, activate, deactivate, active, error } = useWeb3React()
  const [cookies, setCookie, removeCookie] = useCookies(['loggedIn'])
  const router = useRouter()
  const tried = useEagerConnect()
  const address = useStoreState(AccountStore, s => s.address)

  useEffect(() => {
    // Update account info when connection already established
    if (tried && active && (
      !account || (account !== address)
      )) {
      login(account, setCookie)
    }

    if (tried && active && !router.pathname.startsWith('/dapp')) {
      router.push('/dapp')
    }

    if (tried && !active && router.pathname.startsWith('/dapp')) {
      logout(removeCookie)
      router.push('/')
    }
  }, [active, tried, account])

  useEffect(() => {
    if (connector) {
      const lastConnector = getConnector(connector)
      if (active) {
        mixpanel.track('Wallet connected', {
          vendor: lastConnector.name,
          eagerConnect: false,
        })
        AccountStore.update((s) => {
          s.connectorIcon = getConnectorImage(lastConnector)
        })
        localStorage.setItem('eagerConnect', true)
      } else {
        AccountStore.update((s) => {
          s.connectorIcon = null
        })
      }
    }
  }, [active])

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
		if (localStorage.locale) {
			setLocale(localStorage.locale)
		}
  }, [])
  
  useEffect(() => {
    let lastURL = window.location.pathname

    router.events.on('routeChangeComplete', (url) => {
      mixpanel.track('Page View', {
        fromURL: lastURL,
        toURL: url
      })

      lastURL = url
    })
  }, [])

  const onLocale = async newLocale => {
    const locale = await setUtilLocale(newLocale)
    setLocale(locale)
    window.scrollTo(0, 0)
  }

  return (
    <>
    	<AccountListener />
      <TransactionListener />
      <UserActivityListener />
      <LoginModal />
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
    </>
  )
}

App.getInitialProps = async ({ ctx }) => {
  const { loggedIn } = cookies(ctx)

  // server side redirect to dapp
  if (ctx.res && loggedIn && !ctx.req.url.startsWith('/dapp')) {
    ctx.res.writeHead(301, {
      Location: '/dapp'
    })
    ctx.res.end();
  } else if (ctx.res && !loggedIn && ctx.req.url.startsWith('/dapp')) {
    ctx.res.writeHead(301, {
      Location: '/'
    })
    ctx.res.end();
  }

  return { }
}


export default withWeb3Provider(App)
