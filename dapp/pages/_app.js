import React, { useEffect, useState } from 'react'
import { Web3Provider } from '@ethersproject/providers'
import { Web3ReactProvider } from '@web3-react/core'

import AccountListener from 'components/AccountListener'
import setUtilLocale from 'utils/setLocale'
import { useEagerConnect } from 'utils/hooks'

import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'

function getLibrary(provider) {
  const library = new Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

function App({ Component, pageProps }) {
	const [ready, setReady] = useState(true)
	const [locale, setLocale] = useState('en_US')

	useEagerConnect()

// 	useEffect(() => {
// 		const setup = async () => {
// 	    try {
// 	      const locale = await setLocale()
// 	      setLocale(locale)
// 	      setReady(true)
// 	    } catch (error) {
// 	      console.error('Error setting up locale', error)
// 	    }
// 		}
// 
// 		setup()
// 	}, [])

	useEffect(() => {
		if (process.browser) {
			if (localStorage.locale) {
				setLocale(localStorage.locale)
			}
		}
	}, [process.browser])

  const onLocale = async newLocale => {
    const locale = await setUtilLocale(newLocale)
    setLocale(locale)
    window.scrollTo(0, 0)
  }

  if (!ready) return null
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
    	<AccountListener />
      <Component
      	locale={locale}
      	onLocale={onLocale}
      	{...pageProps }
      />
    </Web3ReactProvider>
  )
}

export default App
