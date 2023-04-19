import { Typography } from "@originprotocol/origin-storybook";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { DripperGraph } from "../components";

interface DripperFundsProps {
  overrideCss?: string;
}

const DripperFunds = ({ overrideCss }: DripperFundsProps) => {
  return (
    <Section
      className={twMerge("bg-origin-bg-black pt-14 md:pt-20", overrideCss)}
    >
      <Typography.H5 className="text-center">Dripper funds</Typography.H5>
      <Typography.Body3 className="text-sm mt-3 text-center text-table-title">
        Historical view of funds held in the dripper
      </Typography.Body3>
      <DripperGraph
        className="mt-8 md:mt-14"
        graphId={3}
        title="Funds held by dripper"
        bgClassName="bg-origin-bg-grey"
      />
    </Section>
  );
};

export default DripperFunds;
