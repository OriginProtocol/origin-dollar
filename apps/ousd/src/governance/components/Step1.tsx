import React from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import { assetRootPath } from "../../utils/image";

interface Step1Props {
  className?: string;
}

const Step1 = ({ className }: Step1Props) => {
  return (
    <div className={className}>
      <Typography.Body2>
        OGV can be purchased from many of the top AMMs and exchanges.
      </Typography.Body2>

      {/* AMMs */}
      <Typography.Body3 className="text-xs mt-6">AMMs</Typography.Body3>
      <div className="mt-4 flex">
        <LogoBackground
          imgRoute={assetRootPath("/images/curve.svg")}
          imgSize={84}
        />
        <LogoBackground
          imgRoute={assetRootPath("/images/uniswap.svg")}
          imgSize={96}
          className="ml-2"
        />
      </div>

      {/* Exchanges */}
      <Typography.Body3 className="text-xs mt-6">Exchanges</Typography.Body3>
      <div className="mt-4 flex flex-wrap justify-start">
        <LogoBackground
          imgRoute={assetRootPath("/images/huobi.svg")}
          imgSize={84}
        />
        <LogoBackground
          imgRoute={assetRootPath("/images/kucoin.svg")}
          imgSize={96}
        />
        <LogoBackground
          imgRoute={assetRootPath("/images/gate.io.svg")}
          imgSize={84}
        />
        <LogoBackground
          imgRoute={assetRootPath("/images/bitget.svg")}
          imgSize={84}
        />
        <LogoBackground
          imgRoute={assetRootPath("/images/mexc-global.svg")}
          imgSize={124}
        />
      </div>

      <Typography.Body2 className="font-medium mt-8 text-blurry">
        Unsure how much OGV you need?
      </Typography.Body2>

      <Typography.Body2 className="font-normal mt-2 text-white-grey">
        Use the calculator below to see how much staked OGV you would need to
        create off-chain and on-chain proposals.
      </Typography.Body2>
    </div>
  );
};

interface LogoBackgroundProps {
  imgRoute: string;
  imgSize: number;
  className?: string;
}

const LogoBackground = ({
  imgRoute,
  imgSize,
  className,
}: LogoBackgroundProps) => {
  return (
    <div
      className={twMerge(
        "bg-origin-bg-greyt w-fit py-4 px-6 rounded-lg flex justify-center items-center m-1",
        className
      )}
    >
      <Image src={imgRoute} width={imgSize} height={imgSize} alt="Logo" />
    </div>
  );
};

export default Step1;
