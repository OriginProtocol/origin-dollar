import React from "react";
import Image from "next/image";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { Button } from "@originprotocol/origin-storybook";
import { smSize } from "../../constants";

interface StakingBannerProps {
  stakingApy: number;
  width: number;
}

const StakingBanner = ({ stakingApy, width }: StakingBannerProps) => {
  return (
    <Section
      className="bg-origin-bg-black"
      innerDivClassName="relative h-fit mx-auto gradient3a rounded-2xl sm:rounded-lg overflow-hidden mt-28"
    >
      <Image
        src={assetRootPath("/images/splines2.png")}
        width="500"
        height="500"
        className="absolute bottom-0 right-0 translate-x-1/3 sm:translate-x-0"
        alt="Splines"
      />
      <div className="flex justify-between items-center p-10 sm:p-14 h-full">
        <div className="z-10 w-full">
          <h4 className="font-sansSailec font-bold text-3xl md:text-4xl lg:text-5xl">
            Stake OGV
          </h4>
          <h4 className="font-sansSailec font-bold text-3xl md:text-4xl lg:text-5xl text-gradient1">
            Earn {stakingApy.toFixed(2)}% APY
          </h4>
          <p className="font-sansInter font-normal text-base md:text-lg mt-4 mb-1">
            Fees and voting rights accrue to OGV stakers.{" "}
          </p>
          <p className="font-sansInter font-normal text-base md:text-lg mb-8">
            Control the future of OUSD and profit from its growth.
          </p>

          {width < smSize && <StakeBannerButtons />}
        </div>
        {width >= smSize && <StakeBannerButtons />}
      </div>
    </Section>
  );
};

const StakeBannerButtons = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full md:w-fit z-10 sm:ml-12">
      <a
        target="_blank"
        rel="noopener noreferrer"
        href="https://governance.ousd.com/stake"
        className="w-full flex justify-center"
      >
        <button className="rounded-full w-full sm:w-fit bg-gradient1 text-sm sm:text-base p-[1px] cursor-pointer text-center mb-2">
          <span className="block px-12 md:px-16 py-4 bg-[#4c2d87] rounded-full whitespace-nowrap">
            Stake OGV
          </span>
        </button>
      </a>
      <Button
        target="_blank"
        rel="noopener noreferrer"
        href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
        className="block sm:inline text-center text-sm sm:text-base w-full sm:w-[11rem] md:w-[13rem]"
      >
        Buy OGV
      </Button>
    </div>
  );
};

export default StakingBanner;
