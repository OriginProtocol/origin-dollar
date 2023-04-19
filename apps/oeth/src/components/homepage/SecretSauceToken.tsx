import React from "react";
import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { assetRootPath } from "../../utils";
import { Typography } from "@originprotocol/origin-storybook";

interface SecretSauceTokenProps {
  img: string;
  protocolName: string;
  symbol: string;
  apy: number;
  className?: string;
}

const SecretSauceToken = ({
  img,
  protocolName,
  symbol,
  apy,
  className,
}: SecretSauceTokenProps) => {
  return (
    <div
      className={twMerge(
        "bg-origin-bg-grey flex flex-col items-center py-6 text-white",
        className
      )}
    >
      <Image
        src={assetRootPath(`/images/${img}.svg`)}
        width={32}
        height={32}
        alt={protocolName + " " + symbol}
      />

      <Typography.Body3 className="text-sm font-bold mt-1">
        {protocolName}
      </Typography.Body3>
      <Typography.Body3 className="text-xs">{symbol}</Typography.Body3>
      <Typography.Body className="mt-1">{apy}%</Typography.Body>
      <Typography.Body3 className="text-xs">APY</Typography.Body3>
    </div>
  );
};

export default SecretSauceToken;
