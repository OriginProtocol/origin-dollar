import React, { useState, useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { useWeb3React } from '@web3-react/core'
import { useStoreState } from 'pullstate'
import { ethers, Contract, BigNumber } from 'ethers'

import withIsMobile from 'hoc/withIsMobile'
import analytics from 'utils/analytics'
import { formatCurrency } from 'utils/math'
import ContractStore from 'stores/ContractStore'
import CoinStore from 'stores/CoinStore'
import addresses from 'constants/contractAddresses'
import useCurveStaking from 'hooks/useCurveStaking'
import { assetRootPath } from 'utils/image'

// Just adding the methods we are using
const gaugeMiniAbi = [
  {
    name: 'working_supply',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'inflation_rate',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [],
    stateMutability: 'view',
    type: 'function',
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'reward_data',
    inputs: [{ name: 'arg0', type: 'address' }],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'distributor', type: 'address' },
      { name: 'period_finish', type: 'uint256' },
      { name: 'rate', type: 'uint256' },
      { name: 'last_update', type: 'uint256' },
      { name: 'integral', type: 'uint256' },
    ],
  },
]
const gaugeControllerMiniAbi = [
  {
    name: 'gauge_relative_weight',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [{ type: 'address', name: 'addr' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'gauge_relative_weight',
    outputs: [{ type: 'uint256', name: '' }],
    inputs: [
      { type: 'address', name: 'addr' },
      { type: 'uint256', name: 'time' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

const CurveStake = ({ rpcProvider, isMobile }) => {
  const { active } = useWeb3React()
  const [crvBaseApy, setCrvBaseApy] = useState(false)
  const [crvBoostedApy, setCrvBoostedApy] = useState(false)
  const [ognApy, setOgnApy] = useState(false)
  const [totalBaseApy, setTotalBaseApy] = useState(false)
  const [totalBoostedApy, setTotalBoostedApy] = useState(false)
  const [gaugeContract, setGaugeContract] = useState(false)
  const [gaugeControllerContract, setGaugeControllerContract] = useState(false)
  const chainId = useStoreState(ContractStore, (s) => s.chainId)
  const readOnlyProvider = useStoreState(
    ContractStore,
    (s) => s.readOnlyProvider
  )
  const ognPrice = useStoreState(CoinStore, (s) => s.ogn.price)
  const { baseApy, virtualPrice, curveRate } = useCurveStaking()

  const setupContracts = () => {
    if (chainId !== 1 || !readOnlyProvider) return

    setGaugeContract(
      new Contract(
        addresses.mainnet.CurveOUSDFactoryGauge,
        gaugeMiniAbi,
        readOnlyProvider
      )
    )
    setGaugeControllerContract(
      new Contract(
        addresses.mainnet.CurveGaugeController,
        gaugeControllerMiniAbi,
        readOnlyProvider
      )
    )
  }

  /*
   * Using `getApy` function from the curve source code:
   *
   * https://github.com/curvefi/curve-js/blob/efbf7eebf31bf67c07e67f63796eb01a304bc5d1/src/pools.ts#L1131-L1149
   */
  const fetchGaugeApy = async () => {
    const [weight, inflation, workingSupply] = await Promise.all([
      gaugeControllerContract['gauge_relative_weight(address)'](
        gaugeContract.address
      ),
      gaugeContract.inflation_rate(),
      gaugeContract.working_supply(),
    ])

    // can not divide by zero
    if (workingSupply.toString() === '0' || virtualPrice.toString() === '0') {
      setCrvBaseApy(0)
      setCrvBoostedApy(0)
      return
    }

    // important to first multiply and in the end divide, to keep the precision
    const rate = inflation
      .mul(weight)
      .mul(BigNumber.from('31536000'))
      // for better precision
      .mul(BigNumber.from('1000000'))
      .mul(BigNumber.from('2'))
      .div(BigNumber.from('5')) // same as mul by 0.4
      .div(workingSupply)
      .div(virtualPrice)

    // multiply rate with the USD price of CRV token
    const baseApy = rate.mul(BigNumber.from(Math.floor(curveRate * 100)))

    // boosted APY is 2.5 times base APY
    const boostedApy = baseApy.mul(BigNumber.from('5')).div(BigNumber.from('2')) // same as mul by 2.5

    // divided by 1000 to counteract the precision increase a few lines above
    setCrvBaseApy(baseApy.toNumber() / 1000000)
    setCrvBoostedApy(boostedApy.toNumber() / 1000000)
  }

  const fetchOgnApy = async () => {
    const totalSupply = await gaugeContract.totalSupply()
    const rewardData = await gaugeContract.reward_data(addresses.mainnet.OGN)

    const tokensReceived = rewardData.rate.mul(BigNumber.from('31536000')) // seconds in a year
    const apy = tokensReceived
      // times 10000 so we keep the decimal point precision
      .mul(BigNumber.from(Math.round(ognPrice * 10000)))
      // important to first multiply and in the end divide, to keep the precision
      .div(totalSupply)
      .toNumber()

    // divide only by 100 instead of 10000 for percentage representation
    setOgnApy(apy / 100)
  }

  useEffect(() => {
    setupContracts()
  }, [readOnlyProvider])

  useEffect(() => {
    if (
      !gaugeContract ||
      !gaugeControllerContract ||
      !virtualPrice ||
      !curveRate ||
      !ognPrice
    )
      return

    fetchGaugeApy()
    fetchOgnApy()
  }, [
    gaugeContract,
    gaugeControllerContract,
    virtualPrice,
    curveRate,
    ognPrice,
  ])

  useEffect(() => {
    if (
      baseApy === false ||
      crvBaseApy === false ||
      crvBoostedApy === false ||
      ognApy === false
    )
      return

    setTotalBaseApy(baseApy + crvBaseApy + ognApy)
    setTotalBoostedApy(baseApy + crvBoostedApy + ognApy)
  }, [baseApy, crvBaseApy, crvBoostedApy, ognApy])

  return (
    <>
      <>
        <div className="home d-flex flex-column">
          <div className="crv-header">
            <h1>
              {fbt(
                'Earn OGN and CRV rewards by providing liquidity on Curve',
                'Earn OGN curve title'
              )}
            </h1>
            <div className="d-flex flex-md-row flex-column w-100 ">
              <div className="box black mr-md-10 d-flex flex-column align-items-center justify-content-center">
                <div className="title">{fbt('Total APY', 'Total APY')}</div>
                <div className="value">
                  {totalBaseApy !== false && totalBoostedApy !== false
                    ? `${formatCurrency(totalBaseApy, 2)}-${formatCurrency(
                        totalBoostedApy,
                        2
                      )}%`
                    : '--%'}
                </div>
              </div>
              <div className="box group flex-grow-1">
                <div className="d-flex flex-md-row flex-column h-100">
                  <div className="box-item d-flex flex-row flex-md-column border-right-md col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('Base APY', 'Base APY')}</div>
                    <div className="value">
                      {baseApy !== false
                        ? `${formatCurrency(baseApy, 2)}%`
                        : '--%'}
                    </div>
                  </div>
                  <div className="box-item d-flex flex-row flex-md-column border-right-md col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('CRV APY', 'CRV APY')}</div>
                    <div className="value">
                      {crvBaseApy !== false && crvBoostedApy !== false
                        ? `${formatCurrency(crvBaseApy, 2)}-${formatCurrency(
                            crvBoostedApy,
                            2
                          )}%`
                        : '--%'}
                    </div>
                  </div>
                  <div className="d-flex flex-row flex-md-column col-md-4 align-items-center justify-content-md-center justify-content-between">
                    <div className="title">{fbt('OGN APY', 'OGN APY')}</div>
                    <div className="value">
                      {ognApy !== false
                        ? `${formatCurrency(ognApy, 2)}%`
                        : '--%'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="curve-logo-holder d-flex">
              <div className="powered-by">
                {fbt('Powered by', 'Powered by')}
              </div>
              <img src={assetRootPath('/images/curve-logo-smaller.svg')} />
            </div>
          </div>
          <div className="crv-body d-flex flex-md-row flex-column">
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start border-right2-md border-bottom-sm">
              <div className="step d-flex align-items-center justify-content-center">
                1
              </div>
              <div className="text-center description pl-md-0">
                {fbt(
                  'Provide OUSD + USDT/USDC/ DAI liquidity to the Curve OUSD pool',
                  'Provide OUSD + USDT/USDC/DAI liquidity to the Curve OUSD pool'
                )}
              </div>
            </div>
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start border-right2-md border-bottom-sm">
              <div className="step d-flex align-items-center justify-content-center">
                2
              </div>
              <div className="text-center description">
                {fbt(
                  'Click “Deposit & stake in gauge”',
                  'Click “Deposit & stake in gauge”'
                )}
              </div>
              <a
                href="https://curve.fi/factory/9/deposit"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-blue mt-md-auto"
                onClick={() => {
                  analytics.track('On Add Liquidity', {
                    category: 'navigation',
                  })
                }}
              >
                {fbt('Add Liquidity', 'Add Liquidity Button')}
              </a>
            </div>
            <div className="step-holder col-md-4 d-flex flex-column align-items-center justify-content-start">
              <div className="step d-flex align-items-center justify-content-center">
                3
              </div>
              <div className="text-center description pr-md-0">
                {fbt(
                  'Once staked, click the “Claim” button on Curve to claim your OGN & CRV rewards',
                  'Once staked, click the “Claim” button on Curve to claim your OGN & CRV rewards'
                )}
              </div>
              <a
                href="https://curve.fi/factory/9/withdraw"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-blue mt-md-auto"
                onClick={() => {
                  analytics.track('On Claim Rewards', {
                    category: 'navigation',
                  })
                }}
              >
                {fbt('Claim Rewards', 'Claim Rewards Button')}
              </a>
            </div>
          </div>
        </div>
      </>
      <style jsx>{`
        .home {
          min-width: 940px;
          border-radius: 10px;
          box-shadow: 0 2px 14px 0 rgba(0, 0, 0, 0.1);
          border: solid 1px #dfe9ee;
          background-color: white;
          padding: 60px 0px 0px 0px;
        }

        .crv-header {
          padding: 0px 44px;
          margin-bottom: 60px;
          position: relative;
        }

        .curve-logo-holder {
          position: absolute;
          bottom: -40px;
          right: 20px;
        }

        .crv-body {
          border-radius: 0 0 10px 10px;
          border-top: solid 1px #e9eff4;
          background-color: #fafbfc;
          padding: 40px 30px;
        }

        .step {
          width: 50px;
          height: 50px;
          border-radius: 25px;
          background-color: #183140;
          color: white;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 25px;
        }

        h1 {
          font-family: Poppins;
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          color: black;
          margin-bottom: 25px;
        }

        .box {
          border-radius: 10px;
          border: solid 1px black;
          background-color: #183140;
          color: white;
          min-height: 126px;
          min-width: 226px;
        }

        .box.black {
          background-color: black;
        }

        .box .title {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .box .value {
          font-size: 18px;
          font-weight: bold;
        }

        .mr-md-10 {
          margin-right: 10px;
        }

        .box.group {
          padding-top: 20px;
          padding-bottom: 20px;
        }

        .box.group .title {
          font-size: 14px;
          margin-bottom: 5px;
        }

        .box.group .value {
          font-size: 18px;
          font-weight: bold;
        }

        .border-right-md {
          border-right: solid 1px #000;
        }

        .border-right2-md {
          border-right: solid 1px #cdd7e0;
        }

        .border-bottom-sm {
          border-bottom: 0;
        }

        .step-holder {
          min-height: 240px;
        }

        .description {
          font-size: 18px;
          padding: 0px 30px;
        }

        a.btn {
          margin: 0px 20px;
          padding: 0px 40px;
        }

        .powered-by {
          font-size: 10px;
          color: #576c7a;
        }

        @media (max-width: 799px) {
          .mr-md-10 {
            margin-right: 0px;
          }

          .home {
            min-width: auto;
            padding: 40px 0px 0px 0px;
          }

          h1 {
            font-size: 20px;
            margin-bottom: 20px;
          }

          .crv-header {
            padding: 0px 20px;
            margin-bottom: 40px;
          }

          .curve-logo-holder {
            bottom: -30px;
          }

          .border-right2-md {
            border-right: 0;
          }

          .border-right-md {
            border-right: 0;
          }

          .border-bottom-sm {
            border-bottom: solid 1px #cdd7e0;
          }

          .crv-body {
            padding: 10px 30px;
          }

          .box {
            min-height: 126px;
            min-width: auto;
            margin-bottom: 10px;
          }

          .box.group {
            margin-bottom: 0px;
          }

          .box-item {
            margin-bottom: 20px;
          }

          .step-holder {
            min-height: auto;
            padding: 30px 0px;
          }

          .description {
            font-size: 16px;
            padding: 0px 15px;
          }

          a.btn {
            margin-top: 25px;
          }
        }
      `}</style>
    </>
  )
}

export default withIsMobile(CurveStake)
