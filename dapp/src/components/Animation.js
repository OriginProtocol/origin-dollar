import React, { useState, useEffect } from 'react'
import { Typography, Header } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { animateValue } from 'utils/animation'
import { useStoreState } from 'pullstate'
import ContractStore from 'stores/ContractStore'
import { DEFAULT_SELECTED_APY } from 'utils/constants'
import { zipObject } from 'lodash'
import { formatCurrency } from 'utils/math'
import addresses from 'constants/contractAddresses'

const Animation = ({ navLinks }) => {
  const [totalOusd, setTotalOusd] = useState()
  const ousdInitialValue = parseFloat(totalOusd - 2000000, 0)
  const [ousdValue, setOusdValue] = useState(ousdInitialValue)
  const ousd = useStoreState(ContractStore, (s) => s.ousd || 0)

  const goodTempo = 10000

  /*useEffect(() => {
    if (!totalOusd) return
    return animateValue({
      from: ousdInitialValue,
      to:
        parseFloat(totalOusd),
      callbackValue: (value) => {
        setOusdValue(formatCurrency(value, 0))
      },
      duration: 10 * 1000, // animate for 1 hour
      id: 'hero-index-ousd-animation',
    })
  }, [])*/

  useEffect(() => {
    if (!ousd) {
      return
    }
    const fetchTotalSupply = async () => {
      const total = await ousd.totalSupply().then((r) => Number(r) / 10 ** 18)
      setTotalOusd(total)
    }
    fetchTotalSupply()
  }, [ousd])

  return (
    <section className="intro black">
      <Header mappedLinks={navLinks} webProperty="ousd" />
      <div className="flex flex-col md:flex-row items-center max-w-screen-xl mx-auto relative overflow-hidden pt-10 px-8">
        <div>
          <Typography.H2>
            The most trusted <br className="hidden md:block" />
            <span className="gradient-ousd font-bold py-1">
              yield-generating,{' '}
            </span>
            <br className="hidden md:block" />
            self-custodial, <br className="block" /> stablecoin
          </Typography.H2>
          <br className="block" />
          <Typography.Body2 className="opacity-75">
            {
              'Origin Dollar simplifies DeFi by eliminating the need for staking or lock-ups. Hold OUSD '
            }
            <br className="hidden md:block" />
            in any Ethereum wallet and watch your balance increase every day.
          </Typography.Body2>
          <br className="block" />
          <a
            href="/swap"
            target="_blank"
            rel="noopener noreferrer"
            className="bttn gradient3"
          >
            Get OUSD
          </a>
        </div>
        <div className="container self-end md:self-start flex-1 relative mt-20 md:mt-0 pb-10">
          <div className="hidden md:block">
            <img
              src={assetRootPath('/images/ousd-transparent.svg')}
              className="ousd m-auto pb-4"
              alt="ousd"
            />
          </div>
          {totalOusd && (
            <div className="md:absolute md:bottom-0 md:left-0 md:right-0 md:text-center">
              <Typography.H2 className="flex flex-row md:block">
                {`$${formatCurrency(totalOusd, 0)}`}
                <div className="md:hidden">
                  <img
                    src={assetRootPath('/images/ousd-icon.svg')}
                    className="ousd ml-3 pb-4 w-12"
                    alt="ousd"
                  />
                </div>
              </Typography.H2>
              <Typography.Body2 className="opacity-75 mt-2">
                Total value of OUSD wallet balances
              </Typography.Body2>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Animation
