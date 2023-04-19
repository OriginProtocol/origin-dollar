import { Typography } from "@originprotocol/origin-storybook";
import Image from "next/image";
import React, { FunctionComponent } from "react";
import { twMerge } from "tailwind-merge";
import { assetRootPath } from "../../utils/image";

interface RangeOutputProps {
  title: string;
  value: string;
  className?: string;
}

const RangeOutput: FunctionComponent<RangeOutputProps> = ({
  title,
  value,
  className,
}) => {
  return (
    <div
      className={twMerge(
        "mt-6 p-4 border border-range-border rounded-lg",
        className
      )}
    >
      <Typography.Body3 className="text-sm">{title}</Typography.Body3>
      {/* Data */}
      <div className="bg-origin-bg-grey py-2 px-4 lg:py-3 lg:px-6 rounded-lg my-3 flex items-center justify-between">
        <Typography.Body>{value}</Typography.Body>
        <div className="flex items-center">
          <Image
            src={assetRootPath("/images/ogv.svg")}
            width={32}
            height={32}
            alt="OGV"
          />
          <Typography.Body2 className="ml-1">OGV</Typography.Body2>
        </div>
      </div>

      <Typography.Body3 className="text-xs text-table-title">
        OGV required
      </Typography.Body3>
    </div>
  );
};

export default RangeOutput;
