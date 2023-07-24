import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import withRpcProvider from 'hoc/withRpcProvider'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { get } from 'lodash'
import { assetRootPath } from 'utils/image'
import { useSigner } from 'wagmi'

const UNISWAP_URL =
  'https://app.uniswap.org/#/swap?inputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7&outputCurrency=0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'

const Layout = ({
  children,
  nav,
  short,
  shorter,
  medium,
  showUniswapNotice,
  storeTransaction,
  storeTransactionError,
}) => {
  const { data: signer } = useSigner()
  const oethContract = useStoreState(ContractStore, (s) =>
    get(s, 'contracts.oeth')
  )
  const rebaseOptedOut = useStoreState(AccountStore, (s) =>
    get(s, 'rebaseOptedOut')
  )

  const optIn = async () => {
    try {
      const result = await oethContract.connect(signer).rebaseOptIn()
      storeTransaction(result, `rebaseOptIn`, 'oeth', {})
    } catch (error) {
      // 4001 code happens when a user rejects the transaction
      if (error.code !== 4001) {
        storeTransactionError(`rebaseOptIn`, 'oeth')
      }
      console.error('Error OETH REBASE OPT IN: ', error)
    }
  }

  return (
    <>
      <Head>
        <title>OETH</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta
          property="og:image"
          key="og:image"
          content={assetRootPath('/images/share-facebook.png')}
        />
        <meta
          name="twitter:image"
          key="twitter:image"
          content={assetRootPath('/images/share-twitter.png')}
        />
      </Head>

      <div
        className={classnames(
          'notice text-white text-center p-3 dapp',
          rebaseOptedOut ? '' : 'd-none'
        )}
      >
        <div className="container d-flex flex-column flex-md-row align-items-center">
          <img
            src={assetRootPath('/images/gnosis-safe-icon.png')}
            className="mb-2 mb-md-0 mr-md-3"
            style={{ height: '24px' }}
          />
          <span className="text">
            {fbt(
              'It looks like you are minting from a contract and have not opted into yield. You must opt in to receive yield.',
              'Rebase opt in notice'
            )}
          </span>
          <button
            onClick={optIn}
            rel="noopener noreferrer"
            className="btn btn-dark mt-3 mt-md-0 ml-md-auto"
          >
            Opt in
          </button>
        </div>
      </div>
      <div
        className={classnames(
          'notice text-white text-center p-3 dapp',
          showUniswapNotice ? '' : 'd-none'
        )}
      >
        <div className="container d-flex flex-column flex-md-row align-items-center">
          <img
            src={assetRootPath('/images/horsey.svg')}
            className="mb-2 mb-md-0 mr-md-3"
          />
          {fbt(
            'Gas fees are high right now. It might be cheaper to buy OETH on Uniswap.',
            'Uniswap notice'
          )}
          <a
            href={UNISWAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-dark mt-3 mt-md-0 ml-md-auto"
          >
            Try Uniswap
          </a>
        </div>
      </div>
      <main className={classnames('dapp', { short, shorter, medium })}>
        {nav}
        {<div className="container">{children}</div>}
      </main>
      {/*{<AppFooter locale={locale} onLocale={onLocale} />}*/}
      <style jsx>{`
        .notice {
          background-color: #0074f0;
          margin-bottom: 0px;
        }

        .notice.burn {
          background: linear-gradient(90deg, #8c66fc -28.99%, #0274f1 144.97%);
        }

        .notice.staking {
          background-color: #1a82ff;
        }

        .notice.dapp {
          margin-bottom: 0px;
        }

        .notice.disclaimer {
          background-color: #ff4e4e;
        }

        .notice .btn {
          font-size: 12px;
          height: auto;
          padding: 5px 20px;
          background-color: #fafbfb;
          color: #02080d;
        }

        .container {
          max-width: 1180px;
          padding-left: 0px;
          padding-right: 0px;
        }

        .text {
          color: #fafbfb;
          line-height: normal;
          font-size: 12px;
          max-width: 1000px;
          font-weight: 500;
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(Layout)
