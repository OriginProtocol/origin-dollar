import React, { useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { useStoreState } from 'pullstate'
import useCirculatingSupplyQuery from '../queries/useCirculatingSupplyQuery'
import usePriceQuery from '../queries/usePriceQuery'
import useTotalSupplyQuery from '../queries/useTotalSupplyQuery'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'

const Ogv = () => {
  const price = useStoreState(ContractStore, (s) => {
    return s.ogv.price || 0
  })

  const circulatingSupply = useStoreState(ContractStore, (s) => {
    return s.ogv.circulating || 0
  })

  const totalSupply = useStoreState(ContractStore, (s) => {
    return s.ogv.total || 0
  })

  const priceQuery = usePriceQuery({
    onSuccess: (price) => {
      ContractStore.update((s) => {
        s.ogv.price = price['origin-dollar-governance'].usd
      })
    },
  })

  const circulatingSupplyQuery = useCirculatingSupplyQuery({
    onSuccess: (circulatingSupply) => {
      ContractStore.update((s) => {
        s.ogv.circulating = circulatingSupply
      })
    },
  })

  const totalSupplyQuery = useTotalSupplyQuery({
    onSuccess: (totalSupply) => {
      ContractStore.update((s) => {
        s.ogv.total = totalSupply
      })
    },
  })

  useEffect(() => {
    priceQuery.refetch()
    circulatingSupplyQuery.refetch()
    totalSupplyQuery.refetch()
  }, [price, circulatingSupply, totalSupply])

  return (
    <section className="home gradient3 relative z-0">
      <div className="relative divide-black divide-y-2">
        <div>
          <div className="flex flex-col lg:flex-row overflow-hidden max-w-screen-xl mx-auto lg:pt-10 px-8 pb-20 text-center lg:text-left">
            <div className='lg:w-2/3'>
              <Typography.H1 className="lg:text-left font-bold">
                {fbt('Governed by OGV stakers', 'Governed by OGV stakers')}
              </Typography.H1>
              <br className="block" />
              <Typography.Caption className="lg:text-left opacity-100">
                {fbt(
                  "OUSD's future is shaped by voters who lock their OGV and participate in decentralized governance.",
                  "OUSD's future is shaped by voters who lock their OGV and participate in decentralized governance."
                )}
              </Typography.Caption>
              <img
                src={assetRootPath(`/images/ogv.png`)}
                className="mt-10 mx-auto px-10 block lg:hidden"
              />
              <div className="flex flex-col justify-between w-full md:mx-20 lg:mx-0 lg:w-4/5 mb-20 text-left font-weight-bold mt-10 lg:mt-24 h-36 md:h-52">
                <div className="flex flex-row justify-between">
                  <div className="w-96">
                    <Typography.Body2 className="text-xs lg:text-base mb-2 font-weight-bold">
                      {'OGV PRICE'}
                    </Typography.Body2>
                    <Typography.H5>{`$${formatCurrency(
                      price,
                      4
                    )}`}</Typography.H5>
                  </div>
                  <div className="w-96">
                    <Typography.Body2 className="text-xs lg:text-base mb-2 font-weight-bold">
                      {'OGV MARKET CAP'}
                    </Typography.Body2>
                    <Typography.H5>{`$${formatCurrency(
                      circulatingSupply * price,
                      0
                    )}`}</Typography.H5>
                  </div>
                </div>
                <div className="flex flex-row justify-between">
                  <div className="w-96">
                    <Typography.Body2 className="text-xs lg:text-base mb-2 font-weight-bold">
                      {'CIRCULATING SUPPLY'}
                    </Typography.Body2>
                    <Typography.H5>
                      {formatCurrency(circulatingSupply, 0)}
                    </Typography.H5>
                  </div>
                  <div className="w-96">
                    <Typography.Body2 className="text-xs lg:text-base mb-2 font-weight-bold">
                      {'TOTAL SUPPLY'}
                    </Typography.Body2>
                    <Typography.H5>
                      {formatCurrency(totalSupply, 0)}
                    </Typography.H5>
                  </div>
                </div>
              </div>
              <span className="hidden lg:block w-1/5">
                <a
                  href='https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet'
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn bg-black"
                >
                  {fbt('Buy OGV', 'Buy OGV')}
                </a>
              </span>
              <span className="hidden">
                <a
                  href='/ogv'
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn gradient2"
                >
                  View dashboard
                </a>
              </span>
            </div>
            <div className=''>
              <img
                src={assetRootPath(`/images/ogv.png`)}
                className="hidden lg:block"
              />
              <Typography.Body2 className="my-4 opacity-75 text-center">
                {fbt(
                  'OGV is listed on top exchanges',
                  'OGV is listed on top exchanges'
                )}
              </Typography.Body2>
              <div className="flex flex-row justify-between md:mx-32 lg:mx-0">
                <a
                  href='https://www.huobi.com/en-in/exchange/ogv_usdt'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <img
                    src={assetRootPath(`/images/huobi.svg`)}
                  />
                </a>
                <a
                  href='https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <img
                    src={assetRootPath(`/images/uniswap.svg`)}
                  />
                </a>
                <a
                  href='https://www.kucoin.com/trade/OGV-USDT'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <img
                    src={assetRootPath(`/images/kucoin.svg`)}
                  />
                </a>
              </div>
              <a
                href='https://"app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"'
                target="_blank"
                rel="noopener noreferrer"
                className="bttn bg-black block lg:hidden text-center mt-5"
              >
                {fbt('Buy OGV', 'Buy OGV')}
              </a>
            </div>
          </div>
        </div>
        <div>
          <div className="overflow-hidden max-w-screen-xl mx-auto mt-16 lg:pt-10 px-8 pb-10 lg:pb-20 text-center">
            <div>
              <Typography.H2 className='font-normal'>
                {fbt('Stake OGV', 'Stake OGV')} <br className="block" />
                <span className="text-gradient1 font-bold py-1">
                  {fbt('To Earn OGV', 'To Earn OGV')}
                </span>
              </Typography.H2>
              <br className="block" />
              <Typography.Body2 className="mb-10 font-normal">
                {fbt(
                  'Fees and voting rights accrue to OGV stakers. Control the future of OUSD',
                  'Fees and voting rights accrue to OGV stakers. Control the future of OUSD'
                )}{' '}
                <br className="hidden lg:block" />
                {fbt(
                  'and profit from its growth.',
                  'and profit from its growth.'
                )}
              </Typography.Body2>
              <a
                href="https://governance.ousd.com/stake"
                target="_blank"
                rel="noopener noreferrer"
                className="bttn bg-black"
              >
                {fbt('Earn rewards', 'Earn rewards')}
              </a>
            </div>
          </div>
        </div>
      </div>
      <img
        src={assetRootPath(`/images/splines21.png`)}
        className="absolute w-3/5 left-0 bottom-0 -z-10"
      />
    </section>
  )
}

export default Ogv
