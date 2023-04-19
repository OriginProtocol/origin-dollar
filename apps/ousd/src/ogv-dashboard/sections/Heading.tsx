import React from "react";
import Image from "next/image";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { Button } from "@originprotocol/origin-storybook";

interface HeadingProps {
  stakingApy: number;
}

const Heading = ({ stakingApy }: HeadingProps) => {
  return (
    <Section className="bg-origin-bg-black px-[24px]">
      <div className="flex flex-col md:flex-row relative">
        <div className="relative w-[106px] h-[106px] lg:w-[120px] lg:h-[120px] xl:w-[160px] xl:h-[160px]">
          <div className="absolute w-full h-full z-10 rounded-full shadow-[0px_0px_50px_5px_#fafbfb1a]">
            <Image
              src={assetRootPath("/images/ogv.svg")}
              width="160"
              height="160"
              className="ogv-logo absolute z-10"
              alt="OGV logo"
            />
          </div>
        </div>
        <h1 className="flex items-center font-sansSailec font-bold text-5xl lg:text-6xl xl:text-7xl mt-6 md:mt-0 md:ml-6 lg:ml-12">
          Origin Dollar <br /> Governance (OGV)
        </h1>
      </div>
      <div className="text-white py-8 text-base md:text-xl lg:text-2xl leading-6 lg:leading-8">
        <div className=" text-white mb-2 sm:mb-0 py-1.5">
          OGV is the
          <span className="text-gradient2 font-bold px-1">governance</span>
          and value accrual token for OUSD.
        </div>
        <div>
          Stake to earn
          <span className="text-gradient2 font-bold px-1">
            {stakingApy.toFixed(2)}% APY
          </span>
        </div>
      </div>

      <Button
        target="_blank"
        rel="noopener noreferrer"
        href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
        className="sm:mr-6 mb-3 block sm:inline text-center"
      >
        Buy OGV
      </Button>
      <a
        target="_blank"
        rel="noopener noreferrer"
        href="https://governance.ousd.com/stake"
        className="box-border"
      >
        <button className="rounded-full w-full sm:w-fit box-border bg-gradient1 text-base p-[1px] cursor-pointer text-center">
          <div className="w-full sm:w-auto sm:px-12 py-[0.85rem] bg-origin-bg-black rounded-full box-border">
            Stake OGV
          </div>
        </button>
      </a>
    </Section>
  );
};

export default Heading;
