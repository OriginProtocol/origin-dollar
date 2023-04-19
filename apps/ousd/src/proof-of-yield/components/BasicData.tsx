import Image from "next/image";
import { assetRootPath } from "../../utils/image";
import { PropsWithChildren } from "react";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import TitleWithInfo from "./TitleWithInfo";

interface BasicDataProps {
  title: string;
  info?: boolean;
  className?: string;
}

const BasicData = ({
  title,
  info = true,
  className,
  children,
}: PropsWithChildren<BasicDataProps>) => {
  return (
    <div
      className={twMerge(
        `flex justify-start items-center px-4 lg:px-8 py-4 lg:py-6 bg-origin-bg-grey mr-0.5`,
        className
      )}
    >
      <div>
        {info ? (
          <TitleWithInfo>{title}</TitleWithInfo>
        ) : (
          <Typography.Body2 className="text-xs md:text-base text-table-title">
            {title}
          </Typography.Body2>
        )}
        <Typography.H7 className="block font-bold text-left lg:text-left mt-1 text-xl">
          {children}
        </Typography.H7>
      </div>
    </div>
  );
};

export default BasicData;
