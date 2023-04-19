import React, { useState, useRef } from "react";
import Image from "next/image";
import shortenAddress from "../../utils/shortenAddress";
import { Section } from "../../components";
import { useOutOfBoundsClick } from "../../hooks";
import { assetRootPath } from "../../utils/image";
import { BigNumber, utils } from "ethers";
import { NonCirculatingSupply } from "../types";
import { calculateCirculatingSupply } from "../utils";
const { commify, formatEther } = utils;

interface OgvPriceStatsProps {
  currentPrice: number;
  currentMarketCap: number;
  change24H: number;
  totalSupply: string;
  nonCirculatingSupply: NonCirculatingSupply;
}
const OgvPriceStats = ({
  currentPrice,
  currentMarketCap,
  change24H,
  totalSupply,
  nonCirculatingSupply,
}: OgvPriceStatsProps) => {
  const [showCirculatingTooltip, setShowCirculatingTooltip] = useState(false);
  const [showTotalTooltip, setShowTotalTooltip] = useState(false);

  const circulatingTooltip = useRef<HTMLDivElement>(null);
  const totalTooltip = useRef<HTMLDivElement>(null);

  useOutOfBoundsClick(circulatingTooltip, () =>
    setShowCirculatingTooltip(false)
  );
  useOutOfBoundsClick(totalTooltip, () => setShowTotalTooltip(false));

  return (
    <Section className="bg-origin-bg-black">
      <div className="border-2 border-gray-700 w-full mt-20 rounded-lg grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:border-r-2 border-b-2 xl:border-b-0 flex justify-center items-center border-gray-700 h-fit">
          <div className="py-8">
            <div className="text-base sm:text-xl text-subheading text-center sm:text-left mb-1">
              Current Price
            </div>
            <div className="flex items-center">
              <div className="text-lg md:text-[26px] 2xl:text-3x; font-bold mr-1 text-center sm:text-left">
                {`$${currentPrice.toPrecision(4)}`}
              </div>
              <div
                className={`${
                  change24H < 0 ? "bg-red-500" : "bg-[#66fe90]"
                } px-1 py-1 rounded text-black font-bold text-xs h-fit`}
              >
                <Image
                  className={`${change24H < 0 ? "rotate-180" : ""} inline mr-1`}
                  src={assetRootPath("/images/polygon-1.svg")}
                  alt="Polygon"
                  width="10"
                  height="10"
                />
                {`${change24H.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2,
                })}%`}
              </div>
            </div>
          </div>
        </div>
        <div className="xl:border-r-2 border-b-2 xl:border-b-0 flex justify-center items-center border-gray-700">
          <div className="py-8">
            <div className="text-base sm:text-xl text-subheading text-center sm:text-left mb-1">
              Market Cap
            </div>
            <div className="text-lg md:text-[26px] 2xl:text-3x; font-bold text-center sm:text-left">
              $
              {`${currentMarketCap.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
            </div>
          </div>
        </div>
        <div className="sm:border-r-2 border-b-2 sm:border-b-0 flex justify-center items-center border-gray-700">
          <div className="py-8">
            <div className="text-base sm:text-xl relative text-subheading text-center sm:text-left mb-1">
              Circulating Supply
              <div
                className="sm:relative inline group"
                ref={circulatingTooltip}
                onMouseEnter={() => setShowCirculatingTooltip(true)}
                onMouseLeave={() => setShowCirculatingTooltip(false)}
                onClick={() =>
                  !showCirculatingTooltip && setShowCirculatingTooltip(true)
                }
              >
                {/* We keep group-hover pseudo-selector because despite tooltip visibility being primarily controlled by js, group-hover makes it easier for the user to keep tooltip open  */}
                <div
                  className={`
                         ${showCirculatingTooltip ? "visible" : "invisible"}
                         group-hover:visible
                         sm:right-0 pl-0 sm:pl-2 left-1/2 sm:left-auto top-0 translate-x-[-50%] sm:translate-x-full translate-y-[-99.5%] sm:translate-y-[-25%] absolute h-fit z-10`}
                >
                  <div className="relative bg-tooltip w-fit h-fit text-xs py-4 rounded-sm">
                    <span className="text-base text-white font-bold whitespace-nowrap mx-5 xl:mx-8 overflow-hidden">
                      Wallets excluded from circulating supply
                    </span>
                    <span className="block mt-2 mb-6 mx-8">
                      Circulating supply is calculated as the total supply minus
                      the OGN balances of the following wallets:
                    </span>
                    {nonCirculatingSupply
                      .filter((e) => e.balance !== "0")
                      .map((e, i) => (
                        <div
                          key={e.address}
                          className={`flex justify-between items-center py-3 px-8 ${
                            i === 0 && "border-t-2"
                          } border-b-2 border-black`}
                        >
                          <div className="flex flex-col">
                            <div className="text-[#fafbfb] text-sm sm:text-base w-fit">
                              {e.publicLabel}
                            </div>
                            <a
                              href={`https://etherscan.io/address/${e.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <div className="mt-1 text-gradient2 w-fit">
                                {shortenAddress(e.address)}
                              </div>
                            </a>
                          </div>
                          <div>
                            <span className="text-base">
                              {commify(formatEther(e.balance)).split(".")[0]}
                            </span>
                            <span className="text-xs">{" OGV"}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <Image
                  className="ml-2 cursor-pointer inline"
                  src={assetRootPath("/images/info.svg")}
                  alt="Info"
                  width="20"
                  height="20"
                />
              </div>
            </div>
            <div className="text-lg md:text-[26px] 2xl:text-3x; font-bold text-center sm:text-left">
              {
                commify(
                  formatEther(
                    calculateCirculatingSupply(
                      totalSupply,
                      nonCirculatingSupply
                    )
                  )
                ).split(".")[0]
              }
            </div>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <div className="py-8">
            <div className="text-base sm:text-xl relative text-subheading text-center sm:text-left mb-1">
              Total Supply
              <div
                className="sm:relative inline group"
                ref={totalTooltip}
                onMouseEnter={() => setShowTotalTooltip(true)}
                onMouseLeave={() => setShowTotalTooltip(false)}
                onClick={() => !showTotalTooltip && setShowTotalTooltip(true)}
              >
                <div
                  className={`${
                    showTotalTooltip ? "visible" : "invisible"
                  } group-hover:visible absolute h-fit left-1/2 translate-x-[-50%] sm:left-0 sm:translate-x-0 top-0 translate-y-[-95%]`}
                >
                  <div className="relative sm:left-[-85%] xl:left-[-0.5rem] bg-tooltip w-60 h-16 rounded-sm text-xs text-center p-2 shadow-tooltip">
                    {`Total supply changes over time due to inflation and
                        tokens being burned. `}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://docs.ousd.com/governance/ogv-staking#staking-rewards"
                      className="text-blue-700 cursor-pointer"
                    >
                      Learn more
                    </a>
                  </div>
                  <div className="relative left-[50%] translate-x-[-50%] sm:left-2 sm:translate-x-0 triangle-down"></div>
                </div>
                <Image
                  className="ml-2 cursor-pointer inline"
                  src={assetRootPath("/images/info.svg")}
                  alt="Info"
                  width="20"
                  height="20"
                />
              </div>
            </div>
            <div className="text-lg md:text-[26px] 2xl:text-3x; font-bold text-center sm:text-left">
              {commify(formatEther(totalSupply)).split(".")[0]}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default OgvPriceStats;
