import { Typography } from "@originprotocol/origin-storybook";
import { commify } from "ethers/lib/utils";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";

interface DayTotalProps {
  sectionOverrideCss?: string;
}

const DayTotal = ({ sectionOverrideCss }: DayTotalProps) => {
  return (
    <Section className={twMerge("mt-8 mb-10", sectionOverrideCss)}>
      <div className="w-full flex justify-end bg-origin-bg-grey rounded-lg py-6 px-4 md:px-10">
        <Typography.Body className="inline mr-7">Total earned</Typography.Body>
        <Typography.Body className="inline">
          ${commify(Number(1789.23).toFixed(2))}
        </Typography.Body>
      </div>
    </Section>
  );
};

export default DayTotal;
