import React from 'react'
import { fbt } from 'fbt-runtime'
import { useStoreState } from 'pullstate'
import Link from 'next/link'
import { adjustLinkHref } from 'utils/utils'
import StakeStore from 'stores/StakeStore'
import { get } from 'lodash'

const StakingBanner = () => {
  const stakes = useStoreState(StakeStore, (s) => s)
  const showStakingBanner = get(stakes, 'stakes', []).length !== 0

  return (
    process.env.ENABLE_STAKING_BANNER === 'true' && (
      <>
        {showStakingBanner && (
          <Link href={adjustLinkHref('/earn')}>
            <a>
              <div className="staking-banner d-flex justify-content-center">
                <div className="d-flex flex-column justify-content-center">
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
              </div>
            </a>
          </Link>
        )}
        <style jsx>{`
          .staking-banner {
            min-height: 80px;
            width: 100%;
            padding-bottom: 8px;
            background-color: #1a82ff;
            border-radius: 10px;
            margin-top: 20px;
          }

          .staking-banner .title-text {
            font-size: 20px;
            font-weight: bold;
            line-height: 1.75;
            color: white;
          }

          .staking-banner .text {
            opacity: 0.8;
            color: white;
            line-height: normal;
            font-size: 16px;
            max-width: 1000px;
          }

          @media (max-width: 992px) {
            .staking-banner {
              padding-left: 20px;
              padding-right: 20px;
            }

            .staking-banner .title-text {
              font-size: 16px;
            }

            .staking-banner .text {
              opacity: 0.8;
              font-size: 14px;
            }
          }
        `}</style>
      </>
    )
  )
}

export default StakingBanner
