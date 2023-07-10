import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
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
import { initSentry } from 'utils/sentry'
import {
  getDefaultWallets,
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
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
  appName: 'OETH Dapp',
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

function App({ Component, pageProps, err }) {
  const { address: account, isConnected: active } = useAccount()
  const [locale, setLocale] = useState('en_US')
  const [, setCookie] = useCookies(['loggedIn'])
  const router = useRouter()
  const address = useStoreState(AccountStore, (s) => s.address)
  const canonicalUrl = (
    `https://app.oeth.com` + (router.asPath === '/' ? '' : router.asPath)
  ).split('?')[0]

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
        theme={darkTheme({
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
