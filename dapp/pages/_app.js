import React, { useEffect, useState } from 'react'
import cookies from 'next-cookies'
import { useWeb3React } from '@web3-react/core'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { useStoreState } from 'pullstate'

import { AccountStore } from 'stores/AccountStore'
import AccountListener from 'components/AccountListener'
import withWeb3Provider from 'hoc/withWeb3Provider'
import setUtilLocale from 'utils/setLocale'
import { useEagerConnect } from 'utils/hooks'
import { logout, login } from 'utils/account'

import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'

function App({ Component, pageProps }) {
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
    if (error) {
      alert(error)
      console.log(error)
    }
  }, [])

	useEffect(() => {
		if (localStorage.locale) {
			setLocale(localStorage.locale)
		}
	}, [])

  const onLocale = async newLocale => {
    const locale = await setUtilLocale(newLocale)
    setLocale(locale)
    window.scrollTo(0, 0)
  }

  return (
    <>
    	<AccountListener />
      <Component
      	locale={locale}
      	onLocale={onLocale}
      	{...pageProps }
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
  }

  return { }
}


export default withWeb3Provider(App)
