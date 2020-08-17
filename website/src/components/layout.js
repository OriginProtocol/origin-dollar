import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { useWeb3React } from '@web3-react/core'
import AccountStore from 'stores/AccountStore'

import { useEagerConnect, useInactiveListener } from 'utils/hooks'

export default function Layout({ children, dapp }) {
  const context = useWeb3React()
  const router = useRouter()
  const { connector, library, chainId, account, activate, deactivate, active, error } = context
  
  useEagerConnect()
  //useInactiveListener()

  useEffect(() => { 
    if (active && !router.pathname.startsWith('/dapp')) {
      router.push('/dapp')
    }

    if (!active && router.pathname === '/dapp') {
      AccountStore.update(s => {
        s.address = null
        s.allowances = null 
        s.balances = null
      })
      router.push('/')
    }
  })

  useEffect(() => {
    if (error) {
      alert(error)
      console.log(error)
    }
  })

  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main className={classnames(dapp ? 'dapp' : null)}>
        {dapp && <div className="container">
          {children}  
        </div>}
        {!dapp && children}
      </main>
      {!dapp && <footer>
        <div className="container mx-auto pt-10">
          <p className="text-white">Footer</p>
        </div>
      </footer>}
      <style jsx>{`
        main.dapp {

        }
      `}</style>
    </>
  )
}