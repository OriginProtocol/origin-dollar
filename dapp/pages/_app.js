import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useCookies } from 'react-cookie'
import { useStoreState } from 'pullstate'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import AccountStore from 'stores/AccountStore'
import AccountListener from 'components/AccountListener'
import UserActivityListener from 'components/UserActivityListener'
import TransactionListener from 'components/TransactionListener'
import setUtilLocale from 'utils/setLocale'
import { login } from 'utils/account'
import { ToastContainer } from 'react-toastify'
import { pageview } from '../lib/gtm'
import { initSentry } from 'utils/sentry'
import {
  getDefaultWallets,
  RainbowKitProvider,
  connectorsForWallets,
  lightTheme,
} from '@rainbow-me/rainbowkit'
import {
  argentWallet,
  ledgerWallet,
  phantomWallet,
  safeWallet,
  trustWallet,
  zerionWallet,
  mewWallet,
  okxWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { WagmiConfig, createClient, configureChains, useAccount } from 'wagmi'
import { mainnet, localhost } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import '@rainbow-me/rainbowkit/styles.css'
import 'react-toastify/scss/main.scss'
import '../node_modules/bootstrap/dist/css/bootstrap.min.css'
import '../styles/globals.css'

initSentry()

const queryClient = new QueryClient()

// Wagmi Init
const { chains, provider } = configureChains(
  [mainnet, localhost],
  [publicProvider()]
)

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_V2_PROJECT_ID

// Rainbow kit init
const { wallets } = getDefaultWallets({
  appName: 'OUSD',
  projectId,
  chains,
})

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: 'Other',
    wallets: [
      argentWallet({ projectId, chains }),
      mewWallet({ projectId, chains }),
      okxWallet({ projectId, chains }),
      ledgerWallet({ projectId, chains }),
      phantomWallet({ chains }),
      safeWallet({ chains }),
      trustWallet({ projectId, chains }),
      zerionWallet({ projectId, chains }),
    ],
  },
])

const client = createClient({
  autoConnect: true,
  provider,
  connectors,
})

const GeoFenceCheck = dynamic(() => import('components/GeoFenceCheck'), {
  ssr: false,
})

function App({ Component, pageProps, err }) {
  const [locale, setLocale] = useState('en_US')
  const { address: account, isConnected: active } = useAccount()
  const [, setCookie] = useCookies(['loggedIn'])
  const router = useRouter()
  const address = useStoreState(AccountStore, (s) => s.address)
  const canonicalUrl = (
    `https://app.ousd.com` + (router.asPath === '/' ? '' : router.asPath)
  ).split('?')[0]

  useEffect(() => {
    router.events.on('routeChangeComplete', pageview)
    return () => {
      router.events.off('routeChangeComplete', pageview)
    }
  }, [router.events])

  useEffect(() => {
    // Update account info when connection already established
    if (active && (!account || account !== address)) {
      login(account, setCookie)
    }
  }, [active, account])

  useEffect(() => {
    if (localStorage.locale) {
      setLocale(localStorage.locale)
      setUtilLocale(localStorage.locale, true)
    }
  }, [])

  const onLocale = async (newLocale) => {
    const locale = await setUtilLocale(newLocale)
    setLocale(locale)
    window.scrollTo(0, 0)
  }

  return (
    <WagmiConfig client={client}>
      <RainbowKitProvider
        chains={chains}
        theme={lightTheme({
          accentColor: '#396ff6',
          accentColorForeground: 'white',
          borderRadius: 'large',
          fontStack: 'system',
          overlayBlur: 'small',
        })}
      >
        <Head>
          <link rel="canonical" href={canonicalUrl} />
        </Head>
        <QueryClientProvider client={queryClient}>
          <GeoFenceCheck />
          <AccountListener />
          <TransactionListener />
          <UserActivityListener />
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
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}

export default App
