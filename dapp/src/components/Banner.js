import React from 'react'
import classnames from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useStoreState } from 'pullstate'
import { fbt } from 'fbt-runtime'
import StakeStore from 'stores/StakeStore'
import { adjustLinkHref } from 'utils/utils'
import { burnTimer } from 'utils/constants'

const Banner = ({ dapp }) => {
  const { pathname } = useRouter()
  const burnPage = pathname === '/burn'
  const stakePage = pathname === '/earn'
  const stakes = useStoreState(StakeStore, (s) => s)
  const showStakingBanner = dapp && !stakePage && stakes.stakes?.length

  const notice = showStakingBanner || burnTimer().days >= 0

  const StakingBanner = () => {
    return (
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
        <style jsx>{`
          .btn {
            font-size: 12px;
            height: auto;
            padding: 5px 20px;
            background-color: white;
            color: black;
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
  const ClaimBanner = () => {
    return (
      <>
        {fbt('OGV airdrop is live!', 'Airdrop notice')}
        <a
          href={process.env.AIRDROP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-dark mt-3 mt-md-0 ml-md-auto"
        >
          Check eligibility
        </a>
        <style jsx>{`
          .btn {
            font-size: 12px;
            height: auto;
            padding: 5px 20px;
            background-color: white;
            color: black;
          }
        `}</style>
      </>
    )
  }
  const BurnBanner = () => {
    return (
      <>
        {fbt(
          'Only ' +
            fbt.param('burn-days', burnTimer.days) +
            ' days left to claim your OGV before the burn',
          'Burn notice'
        )}
        <Link href={adjustLinkHref('/burn')}>
          <a className="btn btn-dark gradient2 mt-3 mt-md-0 ml-md-auto">
            OGV Burn
          </a>
        </Link>
        <style jsx>{`
          .btn {
            font-size: 12px;
            height: auto;
            padding: 5px 20px;
            color: black;
          }
        `}</style>
      </>
    )
  }
  return (
    <>
      {notice && (
        <div
          className={classnames(
            `notice ${showStakingBanner ? 'staking pt-2' : 'pt-3'} ${
              burnPage ? 'burn' : ''
            } ${dapp ? '' : 'px-lg-5'} text-white text-center pb-3`,
            {
              dapp,
            }
          )}
        >
          <div
            className={`container d-flex flex-column flex-md-row align-items-center ${
              dapp ? '' : 'nav px-lg-5'
            }`}
          >
            {showStakingBanner ? (
              <StakingBanner />
            ) : burnPage ? (
              <ClaimBanner />
            ) : (
              <BurnBanner />
            )}
          </div>
        </div>
      )}
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

export default Banner
