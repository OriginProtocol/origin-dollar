import React from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { Gradient2Button, Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import { formatCurrency } from "../../utils/math";
import { lgSize, mdSize } from "../../constants";
import { useOgv, useViewWidth } from "../../hooks";
import { GrowingWallet } from "../components";
import { commifyToDecimalPlaces } from "../../utils";
import { twMerge } from "tailwind-merge";
import { Dictionary } from "lodash";

interface HeroProps {
  daysToApy: Dictionary<number>;
  initialTvl: number;
  sectionOverrideCss?: string;
}

const Hero = ({ daysToApy, initialTvl, sectionOverrideCss }: HeroProps) => {
  const { totalVeSupply } = useOgv();
  const width = useViewWidth();

  const bullets = [
    "No staking",
    "No lock-ups",
    "Auto-compounding",
    "AAA security rating from Insurace",
    `$${commifyToDecimalPlaces(initialTvl, 2)} total value`,
  ];

  ("px-4 sm:px-4 md:px-4 lg:px-10");

  return (
    <>
      <Section
        className={twMerge("z-10 relative", sectionOverrideCss)}
        innerDivClassName="flex flex-col items-center justify-between max-w-[1432px]"
      >
        {/* Grey background on bottom half */}
        <div className="absolute h-[250px] bg-origin-bg-grey bottom-0 w-[100vw] left-0 z-[-1]">
          <Image
            src={assetRootPath("/images/splines31.png")}
            width={300}
            height={300}
            alt="splines31"
            className="absolute top-0 -translate-y-full"
          />
        </div>

        <Typography.H2
          as="h1"
          className="text-[40px] md:text-[64px] leading-[40px] md:leading-[72px] text-center"
          style={{ fontWeight: 500 }}
        >
          The self-custodial,
          <br />
          <span className="text-gradient2 font-black py-1">
            yield-generating{" "}
          </span>
          <br className="hidden lg:block" />
          stablecoin
        </Typography.H2>
        <Typography.Body3 className="mt-6 leading-[28px] text-subheading">
          100% redeemable for DAI, USDC, and USDT
        </Typography.Body3>
        <Image
          src={assetRootPath("/images/3-coins.svg")}
          width={100}
          height={100}
          alt="3 coins"
          className="mt-6"
        />
        <div
          className={
            "relative bg-gradient2 rounded-[100px] p-[1px] h-fit mt-7 lg:mt-14 w-full md:w-fit"
          }
        >
          <div className="relative bg-origin-bg-black rounded-[100px] px-4 lg:px-2 py-2 text-origin-white flex items-center justify-center md:justify-start">
            <Image
              src={assetRootPath("/images/ousd.svg")}
              width={64}
              height={64}
              alt="OUSD"
              className="mr-2 md:mr-4"
            />
            <div className="flex items-end mr-12">
              <Typography.H3 className="mr-1 md:mr-3">
                {formatCurrency(daysToApy[30] * 100, 2)}%
              </Typography.H3>
              <div className="flex flex-col">
                <Typography.Body3 className="text-[11px] text-table-title translate-y-[5px] md:translate-y-0">
                  30-day
                </Typography.Body3>
                <Typography.H7 className="font-normal">APY</Typography.H7>
              </div>
            </div>
            {width >= mdSize && <GetOusdButton />}
          </div>
        </div>
        {width < mdSize && <GetOusdButton />}

        {/* Wallet container */}
        <div className="mt-10 lg:mt-20 bg-origin-bg-dgreyt w-full flex flex-col lg:flex-row rounded-lg lg:pr-16 relative">
          {width < lgSize && (
            <OusdList className="px-6 pt-6" bullets={bullets} />
          )}
          <GrowingWallet className="mt-10 lg:mt-[72px] lg:mr-14 2xl:mr-[100px] py-3 ml-6 lg:ml-16" />
          {width >= lgSize && <OusdList className="mt-20" bullets={bullets} />}

          <Image
            src={assetRootPath("/images/splines32.png")}
            width={500}
            height={500}
            alt="splines32"
            className="absolute bottom-0 right-0 rounded-br-lg"
          />
        </div>
      </Section>
    </>
  );
};

const GetOusdButton = () => {
  return (
    <Gradient2Button
      onClick={() =>
        window.open(
          `${process.env.NEXT_PUBLIC_DAPP_URL}`,
          "_blank",
          "noopener noreferrer"
        )
      }
      outerDivClassName="w-full md:w-auto mt-4 md:mt-0"
      className="bg-transparent hover:bg-transparent w-full md:w-auto lg:px-20 py-3 lg:py-5"
    >
      <Typography.H7 className="font-normal text-center">
        Get OUSD
      </Typography.H7>
    </Gradient2Button>
  );
};

const OusdList = ({
  bullets,
  className,
}: {
  bullets: string[];
  className?: string;
}) => {
  return (
    <div className={className}>
      <Typography.H4 className="inline">
        Growing in Ethereum wallets
      </Typography.H4>{" "}
      <Typography.H4 className="text-gradient1 inline ml-0.5 md:ml-2">
        since 2020
      </Typography.H4>
      <ul className="home-ul mt-8 lg:mb-20">
        {bullets.map((e, i) => (
          <li className="mt-4" key={i}>
            <Typography.Body>{e}</Typography.Body>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Hero;
