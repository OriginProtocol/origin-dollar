import React, { Children, PropsWithChildren } from "react";
import Image from "next/image";
import { assetRootPath } from "../../utils/image";
import { twMerge } from "tailwind-merge";
import { Typography } from "@originprotocol/origin-storybook";

interface TitleWithInfoProps {
  className?: string;
  textClassName?: string;
}

const TitleWithInfo = ({
  className,
  textClassName,
  children,
}: PropsWithChildren<TitleWithInfoProps>) => {
  return (
    <div
      className={twMerge(
        `font-normal text-table-title w-fit flex items-center`,
        className
      )}
    >
      <Typography.Body2
        className={twMerge(`text-xs md:text-base pr-2`, textClassName)}
      >
        {children}
      </Typography.Body2>
      <Image
        src={assetRootPath("/images/info.svg")}
        width="12"
        height="12"
        alt="info"
        className="inline"
      />
    </div>
  );
};

export default TitleWithInfo;
