import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import ContractStore from "../../stores/ContractStore";
import { Typography } from "@originprotocol/origin-storybook";
import { assetRootPath } from "../../utils/image";
import { formatCurrency } from "../../utils/math";
import { Huobi, Uniswap, Kucoin, Curve } from "../../utils/logos";
import { OgvStats } from "../types";

interface OgvProps {
  stats: OgvStats;
}

const Ogv = ({ stats }: OgvProps) => {
  const { price, circulatingSupply, totalSupply } = stats;

  useEffect(() => {
    ContractStore.update(({ ogvStats }) => {
      ogvStats.price = price;
      ogvStats.circulating = circulatingSupply;
      ogvStats.total = totalSupply;
    });
  }, []);

  // const price = useStoreState(ContractStore, (s) => {
  //   return s.ogvStats.price || 0;
  // });

  // const circulatingSupply = useStoreState(ContractStore, (s) => {
  //   return s.ogvStats.circulating || 0;
  // });

  // const totalSupply = useStoreState(ContractStore, (s) => {
  //   return s.ogvStats.total || 0;
  // });

  return (
    <>
      <section className="gradient3 relative z-0">
        <div className="relative divide-black divide-y-2">
          <div>
            <div className="flex flex-col lg:flex-row overflow-hidden max-w-screen-[1432px] mx-auto px-8 md:px-16 py-14 lg:py-[120px] lg:pl-[134px] lg:pr-[208px] text-center lg:text-left space-x-0 lg:space-x-20 xl:space-x-0">
              <div className="lg:w-2/3">
                <Typography.H2
                  className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px] lg:text-left"
                  style={{ fontWeight: 700 }}
                >
                  Governed by OGV stakers
                </Typography.H2>
                <Typography.Body3 className="mt-[16px] leading-[28px] lg:text-left">
                  {
                    "OUSD's future is shaped by voters who lock their OGV and participate in decentralized governance."
                  }
                </Typography.Body3>
                <div className="mt-8 block lg:hidden">
                  <Image
                    src={assetRootPath(`/images/ogv.svg`)}
                    width="186"
                    height="186"
                    className="mx-auto"
                    alt="ogv"
                  />
                </div>
                <div className="flex flex-col justify-between w-full my-8 md:my-20 lg:w-4/5 text-left font-weight-bold">
                  <div className="flex flex-row justify-between">
                    <div className="w-36 md:w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold tracking-[0.06em]">
                        {"OGV PRICE"}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold lg:text-[28px] xl:text-[40px]">{`$${formatCurrency(
                        price,
                        4
                      )}`}</Typography.H5>
                    </div>
                    <div className="w-36 md:w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold tracking-[0.06em]">
                        {"OGV MARKET CAP"}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold lg:text-[28px] xl:text-[40px]">{`$${formatCurrency(
                        circulatingSupply * price,
                        0
                      )}`}</Typography.H5>
                    </div>
                  </div>
                  <div className="flex flex-row justify-between mt-10">
                    <div className="w-36 md:w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold tracking-[0.06em]">
                        {"CIRCULATING SUPPLY"}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold lg:text-[28px] xl:text-[40px]">
                        {formatCurrency(circulatingSupply, 0)}
                      </Typography.H5>
                    </div>
                    <div className="w-36 md:w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold tracking-[0.06em]">
                        {"TOTAL SUPPLY"}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold lg:text-[28px] xl:text-[40px]">
                        {formatCurrency(totalSupply, 0)}
                      </Typography.H5>
                    </div>
                  </div>
                </div>{" "}
                <span className="hidden lg:flex">
                  <Link
                    href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bttn bg-black !ml-0"
                  >
                    <Typography.H7 className="font-normal">
                      Buy OGV
                    </Typography.H7>
                  </Link>
                  <Link
                    href="/ogv-dashboard"
                    target="_parent"
                    className="bg-black bttn rounded-full"
                  >
                    <Typography.H7 className="font-normal">
                      View dashboard
                    </Typography.H7>
                  </Link>
                </span>
                {/*<span>
                <Link
                  href="/ogv"
                  target="_blank"
                  rel="noopener noreferrer"
                  prefetch={false}
                  className="bttn gradient2"
                >
                  <Typography.H7 className="font-normal">
                    View dashboard
                  </Typography.H7>
                </Link>
                </span>*/}
              </div>
              <div>
                <div className="hidden lg:block">
                  <Image
                    src={assetRootPath(`/images/ogv.svg`)}
                    width="397"
                    height="397"
                    className="hidden lg:block"
                    alt="ogv"
                  />
                </div>
                <Link
                  href="/ogv-dashboard"
                  target="_parent"
                  className="bg-black bttn mb-10 lg:hidden"
                >
                  <Typography.H7 className="font-normal">
                    View dashboard
                  </Typography.H7>
                </Link>
                <Typography.Body3 className="mt-8 text-center text-white opacity-75">
                  OGV is listed on top exchanges
                </Typography.Body3>
                <div className="w-full flex flex-col justify-between items-center mt-0 md:mt-3 mb-8 lg:mx-0">
                  <div className="flex justify-between">
                    <Link
                      href="https://curve.fi/#/ethereum/pools/factory-crypto-205/swap"
                      target="_blank"
                      rel="nofollow noreferrer"
                      className=""
                    >
                      <Curve />
                    </Link>
                    <Link
                      href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="ml-[10px]"
                    >
                      <Uniswap />
                    </Link>
                  </div>
                  <div className="flex items-center">
                    <Link
                      href="https://www.huobi.com/en-in/exchange/ogv_usdt"
                      target="_blank"
                      rel="nofollow noreferrer"
                      className=""
                    >
                      <Huobi />
                    </Link>

                    <Link
                      href="https://www.kucoin.com/trade/OGV-USDT"
                      target="_blank"
                      rel="nofollow noreferrer"
                      className="mt-[8px]"
                    >
                      <Kucoin />
                    </Link>
                  </div>
                </div>
                <Link
                  href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn bg-black block lg:hidden text-center"
                >
                  <Typography.H7 className="font-normal">Buy OGV</Typography.H7>
                </Link>
              </div>
            </div>
          </div>
          <div>
            <div className="overflow-hidden max-w-screen-2xl mx-auto px-8 md:px-[134px] pt-[62px] pb-[52px] md:py-[120px] text-center">
              <div>
                <Typography.H2
                  className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
                  style={{ fontWeight: 500 }}
                >
                  Stake OGV
                </Typography.H2>
                <Typography.H2
                  className="mt-3 md:mt-1 text-[48px] leading-[48px] md:text-[56px] md:leading-[64px] text-gradient1"
                  style={{ fontWeight: 700 }}
                >
                  To Earn OGV
                </Typography.H2>
                <Typography.Body3 className="mt-[16px] mb-10 font-normal text-[#fafbfb]">
                  Fees and voting rights accrue to OGV stakers. Control the
                  future of OUSD <br className="hidden lg:block" />
                  and profit from its growth.
                </Typography.Body3>
                <Link
                  href="https://governance.ousd.com/stake"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn bg-black"
                >
                  <Typography.H7 className="font-normal">
                    Earn rewards
                  </Typography.H7>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Image
          src={assetRootPath(`/images/splines21.png`)}
          width="1073"
          height="1058"
          className="absolute w-3/5 left-0 bottom-0 -z-10"
          alt="splines"
        />
      </section>
    </>
  );
};

export default Ogv;
