import React from 'react'
import classnames from 'classnames'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import { useSigner } from 'wagmi'
import { get } from 'lodash'
import AccountStore from 'stores/AccountStore'
import ContractStore from 'stores/ContractStore'
import StakeStore from 'stores/StakeStore'
import withRpcProvider from 'hoc/withRpcProvider'
import AppFooter from './AppFooter'
import { adjustLinkHref } from 'utils/utils'
import { assetRootPath } from 'utils/image'
import { burnTimer } from 'utils/constants'

const UNISWAP_URL =
  'https://app.uniswap.org/#/swap?inputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7&outputCurrency=0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86'

const Layout = ({
  locale,
  onLocale,
  children,
  short,
  shorter,
  medium,
  isStakePage,
  showUniswapNotice,
  storeTransaction,
  storeTransactionError,
}) => {
  const { data: signer } = useSigner()

  const ousdContract = useStoreState(ContractStore, (s) =>
    get(s, 'contracts.ousd')
  )
  const rebaseOptedOut = useStoreState(AccountStore, (s) =>
    get(s, 'rebaseOptedOut')
  )

  const optIn = async () => {
    try {
      const result = await ousdContract.connect(signer).rebaseOptIn()
      storeTransaction(result, `rebaseOptIn`, 'ousd', {})
    } catch (error) {
      // 4001 code happens when a user rejects the transaction
      if (error.code !== 4001) {
        storeTransactionError(`rebaseOptIn`, 'ousd')
      }
      console.error('Error OUSD REBASE OPT IN: ', error)
    }
  }

  const { pathname } = useRouter()
  const burnPage = pathname === '/burn'
  const stakePage = pathname === '/earn'
  const stakes = useStoreState(StakeStore, (s) => s)
  const showStakingBanner = !stakePage && stakes.stakes?.length

  const notice = showStakingBanner || burnTimer().days >= 0

  return (
    <>
      <Head>
        <title>OUSD</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {isStakePage && (
          <>
            <meta
              property="og:image"
              key="og:image"
              content="https://ousd.com/images/staking-facebook.png"
            />
            <meta
              name="twitter:image"
              key="twitter:image"
              content="https://ousd.com/images/staking-twitter.png"
            />
          </>
        )}
        {!isStakePage && (
          <>
            <meta
              property="og:image"
              key="og:image"
              content="https://ousd.com/images/share-facebook.png"
            />
            <meta
              name="twitter:image"
              key="twitter:image"
              content="https://ousd.com/images/share-twitter.png"
            />
          </>
        )}
      </Head>
      <div
        className={classnames(
          'notice text-white text-center p-3 dapp',
          rebaseOptedOut ? '' : 'd-none'
        )}
      >
        <div className="container d-flex flex-column flex-md-row align-items-center">
          <img
            src={assetRootPath('/images/gnosis-safe-icon.svg')}
            className="mb-2 mb-md-0 mr-md-3"
            style={{ width: '50px' }}
          />
          {fbt(
            'It looks like you are minting from a contract and have not opted into yield. You must opt in to receive yield.',
            'Rebase opt in notice'
          )}
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
            'Gas fees are high right now. It might be cheaper to buy OUSD on Uniswap.',
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
      {notice && (
        <div
          className={classnames(
            `notice ${showStakingBanner ? 'staking pt-2' : 'pt-3'} ${
              burnPage ? 'burn' : ''
            } text-white text-center pb-3 dapp`
          )}
        >
          <div className="container d-flex flex-column flex-md-row align-items-center">
            {showStakingBanner ? (
              <>
                <div className="d-flex flex-column mt-0 justify-content-center px-4 px-md-0 text-md-left">
                  <div className="title-text">
                    {fbt(
                      'Changes are coming to OGN staking.',
                      'Changes are coming to OGN staking.'
                    )}
                  </div>
                  <div className="text">
                    {fbt(
                      'Your existing stakes will not be impacted. Claim your OGN at the end of your staking period.',
                      'Your existing stakes will not be impacted. Claim your OGN at the end of your staking period.'
                    )}
                  </div>
                </div>
                <div className="btn btn-dark mt-2 ml-md-auto">
                  <Link href={adjustLinkHref('/earn')}>Legacy staking</Link>
                </div>
              </>
            ) : burnPage ? (
              <>
                {fbt('OGV airdrop is live!', 'Airdrop notice')}
                <a
                  href={process.env.NEXT_PUBLIC_AIRDROP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-dark mt-3 mt-md-0 ml-md-auto"
                >
                  Check eligibility
                </a>
              </>
            ) : (
              <>
                {fbt(
                  'Only ' +
                    fbt.param('burn-days', burnTimer().days) +
                    ' days left to claim your OGV before the burn',
                  'Burn notice'
                )}
                <Link href={adjustLinkHref('/burn')}>
                  <a className="btn btn-dark gradient1 mt-3 mt-md-0 ml-md-auto">
                    OGV Burn
                  </a>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      <main className={classnames('dapp', { short, shorter, medium })}>
        {<div className="container">{children}</div>}
      </main>
      {<AppFooter locale={locale} onLocale={onLocale} />}
      <style jsx>{`
        .notice {
          background-color: black;
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

        .notice .btn {
          font-size: 12px;
          height: auto;
          padding: 5px 20px;
          background-color: white;
          color: black;
        }

        .container {
          max-width: 940px;
          padding-left: 0px;
          padding-right: 0px;
        }

        .title-text {
          font-size: 18px;
          font-weight: bold;
          line-height: 1.75;
          color: white;
        }

        .text {
          opacity: 0.8;
          color: white;
          line-height: normal;
          font-size: 14px;
          max-width: 1000px;
        }
      `}</style>
    </>
  )
}

export default withRpcProvider(Layout)
