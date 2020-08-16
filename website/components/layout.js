import classnames from 'classnames'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { useWeb3React } from '@web3-react/core'

import { injected } from '../lib/connector'
import { useEagerConnect, useInactiveListener } from '../lib/hooks'

export default function Layout({ children, dapp }) {
  const context = useWeb3React()
  const router = useRouter()
  const { connector, library, chainId, account, activate, deactivate, active, error } = context
  // const triedEager = useEagerConnect()

  useEffect(() => {
    if (active && router.pathname !== '/dapp') {
      router.push('/dapp')
    }

    if (!active && router.pathname === '/dapp') {
      router.push('/')
    }
  })

  useEffect(() => {
    if (error) {
      alert(error)
      console.log(error)
    }
  })

  useInactiveListener()

  return (
    <>
      <Head>
        <title>Next Web3 Experiment</title>
        <meta name="google-site-verification" content="moeqxLiGiVyyBcTg6IScLthBnFKP_vkdCgJkEud1Hqk" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet" />
      </Head>
      <main className={classnames(dapp ? 'dapp' : null)}>{children}</main>
      <footer>
        <div className="container mx-auto pt-10">
          <p className="text-white">Footer</p>
        </div>
      </footer>
    </>
  )
}