import React, { Dispatch, SetStateAction, useState } from "react";
import Section from "../../components/Section";
import Image from "next/image";
import { lgSize, mdSize } from "../../constants";
import { useViewWidth } from "../../hooks";
import { Typography } from "@originprotocol/origin-storybook";
import { assetRootPath } from "../../utils/image";
import { Gradient2Button } from "../../components";

function SecretSauce() {
  const width = useViewWidth();
  const [open, setOpen] = useState(false);

  return (
    <Section className="bg-origin-bg-dgrey" innerDivClassName="max-w-[820px]">
      <Typography.H3 className="pt-14 md:pt-[120px] mb-4 md:mb-20 w-full text-center">
        Not-so-secret sauce
      </Typography.H3>
      <div className="relative h-fit">
        <p className="font-sansInter font-normal text-base md:text-xl xl:text-lg inline mr-2">
          Multiple factors contribute to OUSD outperforming its underlying
          strategies, but there&apos;s one big one. While 100% of the collateral
          is used to generate yield, only some of the OUSD in circulation is
          receiving that yield.
        </p>
        {open && (
          <>
            <p className="font-sansInter font-normal text-sm xl:text-base leading-7 text-subheading mt-8 block">
              By default, OUSD does not grow when it&apos;s held by smart
              contracts. This means that the yield that would go to these smart
              contracts becomes a bonus for all other OUSD holders. OUSD is
              different from most other ERC-20 tokens because your balance
              increases without receiving a transfer. Many smart contracts, such
              as AMMs, are not set up to properly account for these increases.
              So OUSD is designed to allocate this yield to regular wallets
              instead of letting it go to waste. Any smart contract can opt in
              to receive yield, but the reality is that much of OUSD&apos;s
              supply is held in AMMs where liquidity providers are motivated to
              forego their yield in exchange for other incentives. <br /> <br />
            </p>
            <p className="font-sansInter font-normal text-sm xl:text-base leading-7 text-subheading inline mr-2">
              Additional sources of OUSD&apos;s above-market yield include exit
              fees, smart rebalancing, and automated compounding. As the
              protocol grows, OUSD holders enjoy greater economies of scale with
              the cost of funds management spread out over a larger pool of
              users.
            </p>
          </>
        )}
        <OpenButton
          onClick={() => setOpen((b) => !b)}
          imgSrc={`/images/arrow-${open ? "up" : "down"}-g2.svg`}
          text={`${!open ? "Read more" : "Less"}`}
        />
        <div
          className={`relative mt-10 md:mt-20 mx-auto max-w-[85vw] ${
            width < lgSize ? "w-[455px]" : "w-[820px]"
          }`}
        >
          <Image
            src={
              width < lgSize
                ? assetRootPath("/images/secret-sauce-mobile.png")
                : assetRootPath("/images/secret-sauce.png")
            }
            width="1536"
            height="1232"
            className="w-full"
            alt="Secret Sauce"
          />
        </div>
      </div>
      <div className="w-full flex justify-center mt-10 d:mt-20">
        <Gradient2Button
          outerDivClassName="w-full md:w-fit mb-14 md:mb-[120px]"
          className="bg-transparent hover:bg-transparent text-center w-full"
        >
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.ousd.com/core-concepts/elastic-supply/rebasing-and-smart-contracts"
          >
            <Typography.H7 className="px-20 py-2">Learn more</Typography.H7>
          </a>
        </Gradient2Button>
      </div>
    </Section>
  );
}

interface OpenButtonProps {
  onClick: () => void;
  imgSrc: string;
  text: string;
}

const OpenButton = ({ onClick, imgSrc, text }: OpenButtonProps) => {
  return (
    <span
      className="text-left w-fit cursor-pointer whitespace-nowrap"
      onClick={onClick}
    >
      <Typography.Body2 className="text-gradient2 inline font-bold">
        {text}
      </Typography.Body2>
      <Image
        src={assetRootPath(imgSrc)}
        width={12}
        height={12}
        alt=""
        className="inline ml-2"
      />
    </span>
  );
};

export default SecretSauce;
