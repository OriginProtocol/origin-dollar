import React from "react";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";

interface GovernanceStatsProps {
  title: string;
  value: string;
  className?: string;
}

const GovernanceStats = ({ title, value, className }: GovernanceStatsProps) => {
  return (
    <div
      className={twMerge(
        "flex-1 border-t-2 border-origin-bg-grey bg-origin-bg-blackt py-6 border-l-2 w-full lg:w-auto flex justify-center",
        className
      )}
    >
      <div className="text-center lg:text-left">
        <Typography.H6>{value}</Typography.H6>
        <Typography.Body2 className="text-table-title">
          {title}
        </Typography.Body2>
      </div>
    </div>
  );
};

export default GovernanceStats;
