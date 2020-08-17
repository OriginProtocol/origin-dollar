import classnames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useWeb3React } from '@web3-react/core'

import Spinner from './spinner'

import { injected } from '../lib/connector'

export default function Nav({ dapp }) {
  const router = useRouter()
  const context = useWeb3React()
  const { connector, library, chainId, account, activate, deactivate, active, error } = context

  return (
    <div className="container mx-auto">
      <nav className="flex items-center justify-between flex-wrap p-6">
        <div className="flex items-center flex-shrink-0 text-white mr-6">
          <h1 className="logo">Logo</h1>
        </div>
        <div className="block lg:hidden">
          <button className="flex items-center px-3 py-2 border rounded hover:text-white hover:border-white">
            <svg className="fill-current h-3 w-3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <title>Menu</title><path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"/>
            </svg>
          </button>
        </div>
        <div className="w-full block flex-grow lg:flex lg:items-center lg:w-auto">
        {!dapp &&
          <div className="text-sm lg:ml-auto">
            <Link href="/">
              <a className={
                classnames({ active: router.pathname === '/' }, 'nav-item', 'pb-1', 'block', 'mt-4', 'lg:inline-block', 'lg:mt-0', 'hover:text-white', 'lg:ml-20')}>
                Home
              </a>
            </Link>
            <Link href="/earn">
              <a className={
                classnames({ active: router.pathname === '/earn' }, 'nav-item', 'pb-1', 'block', 'mt-4', 'lg:inline-block', 'lg:mt-0', 'hover:text-white', 'lg:ml-20')}>
                Earn
              </a>
            </Link>
            <Link href="/governance">
              <a className={
                classnames({ active: router.pathname === '/governance' }, 'nav-item', 'pb-1', 'block', 'mt-4', 'lg:inline-block', 'lg:mt-0', 'hover:text-white', 'lg:ml-20')}>
                Governance
              </a>
            </Link>
            <Link href="/faq">
              <a className={
                classnames({ active: router.pathname === '/faq' }, 'nav-item', 'pb-1', 'block', 'mt-4', 'lg:inline-block', 'lg:mt-0', 'hover:text-white', 'lg:ml-20')}>
                FAQ
              </a>
            </Link>
            <button
              className="nav-item hover:bg-white hover:text-black py-2 px-4 border border-white rounded-full lg:ml-20"
              onClick={() => {
                activate(injected)
              }}
            >
              {'Connect'}
            </button>
          </div>
        }
        {dapp &&
          <div className="text-sm lg:ml-auto">
            <button
              className="nav-item hover:bg-white hover:text-black py-2 px-4 border border-white rounded-full lg:ml-20"
              onClick={() => {
                const prompt = confirm('Disconnect?')

                if (prompt) {
                  deactivate(injected)
                }
              }}
            >
              {account}
            </button>
          </div>
        }
        </div>
      </nav>
    </div>
  )
}