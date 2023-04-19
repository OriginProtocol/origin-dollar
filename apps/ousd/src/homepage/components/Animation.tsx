import React, { FunctionComponent } from "react";
import Image from "next/image";
import AnimatedNumber from "animated-number-react";
import { assetRootPath } from "../../utils/image";
import { Typography } from "@originprotocol/origin-storybook";
import { formatCurrency } from "../../utils/math";
import { useStoreState } from "pullstate";
import { ContractStore } from "../../stores";

interface AnimationProps {
  initialTvl: number;
}

const Hero: FunctionComponent<AnimationProps> = ({ initialTvl }) => {
  const ousdTvl = useStoreState(ContractStore, (s) => s.ousdTvl || 0);

  return (
    <div className="container self-end lg:self-start flex-1 relative mt-16 lg:mt-14 xl:mt-0 md:pb-10">
      <div className="hidden lg:block">
        <div className="relative w-[382px] h-[382px] m-auto pb-4">
          <Image
            src={assetRootPath("/images/ousd.svg")}
            fill
            sizes="382px"
            alt="ousd"
          />
        </div>
      </div>
      <div className="lg:absolute lg:bottom-0 lg:left-0 lg:right-0 text-center">
        <div className="relative h-32 md:h-64 lg:h-auto flex flex-row lg:block">
          {initialTvl && (
            <div className="absolute right-16 md:right-36 md:top-10 lg:static z-10">
              <Typography.H2
                className="text-[36px] leading-[40px] md:text-[64px] md:leading-[68px] tabular-nums tracking-tighter md:tracking-tight"
                style={{ fontWeight: 700 }}
              >
                {
                  <AnimatedNumber
                    value={ousdTvl ? ousdTvl : initialTvl}
                    duration={2000}
                    formatValue={(num) => {
                      return `$${formatCurrency(num, 2)}`;
                    }}
                  />
                }
              </Typography.H2>
              <Typography.Body3 className="text-sm md:text-base text-subheading pt-[8px] whitespace-nowrap md:pt-[8px]">
                Total value of OUSD wallet balances
              </Typography.Body3>
            </div>
          )}
          <div className="absolute -top-12 -right-16 z-0 block lg:hidden">
            <div className="relative ousd ml-3 w-40 h-40 md:w-64 md:h-64">
              <Image
                src={assetRootPath("/images/ousd.svg")}
                fill
                sizes="(max-width: 768px) 160px, 256px"
                alt="ousd"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
