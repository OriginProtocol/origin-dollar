import React from 'react'
import { fbt } from 'fbt-runtime'

import EarnModal from 'components/earn/modal/EarnModal'
import { formatCurrency } from 'utils/math'

const ApyModal = ({ pool, onClose }) => {
  return (
    <>
      <EarnModal
        closeable={true}
        onClose={onClose}
        bodyContents={
          <div className="apy-body d-flex flex-column align-items-center justify-content-center">
            <div className="apy-row d-flex justify-content-between w-100">
              <div className="title">
                {fbt('Current Staking Reward', 'Current Staking Reward')}
              </div>
              <div className="percentage">25%</div>
            </div>
            <div className="apy-row d-flex justify-content-between w-100">
              <div className="title">
                {fbt('Liquidity Provider Fees', 'Liquidity Provider Fees')}
              </div>
              <div className="percentage">25%</div>
            </div>
            <div className="apy-row d-flex justify-content-between w-100">
              <div className="title">
                {fbt(
                  'Projected Performance Bonus',
                  'Projected Performance Bonus'
                )}
              </div>
              <div className="percentage">25%</div>
            </div>
          </div>
        }
        title={fbt(
          fbt.param('pool name', pool.name) + ' pool APY',
          'Apy of pool with name'
        )}
      />
      <style jsx>{`
        .title {
          font-size: 28px;
          color: #8293a4;
        }

        .percentage {
          font-size: 28px;
          color: #1e313f;
        }

        .apy-row {
          margin-bottom: 20px;
        }

        .apy-body {
          padding-bottom: 30px;
        }

        @media (max-width: 799px) {
        }
      `}</style>
    </>
  )
}

export default ApyModal
