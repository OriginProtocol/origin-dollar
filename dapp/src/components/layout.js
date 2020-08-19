import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import { useEffect, useRef } from 'react'
import { useCookies } from 'react-cookie'

import { AccountStore } from 'stores/AccountStore'
import { useEagerConnect, useInactiveListener } from 'utils/hooks'

export default function Layout({ children, dapp }) {

  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main className={classnames({ dapp })}>
        {dapp && <div className="container">
          {children}  
        </div>}
        {!dapp && children}
      </main>
      {!dapp && <footer>
        <div className="container mx-auto pt-10">
          <p className="text-center">👣</p>
        </div>
      </footer>}
      <style jsx>{`
        main.dapp {

        }
      `}</style>
    </>
  )
}