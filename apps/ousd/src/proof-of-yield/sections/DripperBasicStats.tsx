import { Typography } from "@originprotocol/origin-storybook";
import { commify } from "ethers/lib/utils";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { BasicData } from "../components";

interface DripperBasicStats {
  overrideCss?: string;
}

const DripperBasicStats = ({ overrideCss }: DripperBasicStats) => {
  return (
    <Section className={twMerge("mt-10 md:mt-20", overrideCss)}>
      <Typography.Body>Dripper funds</Typography.Body>
      <div className="w-full lg:w-3/4 max-w-[818px] flex mt-6">
        <BasicData
          className="rounded-l-lg flex-1 justify-center lg:justify-start"
          title="Funds held by dripper"
        >
          ${commify(12602.01)}
        </BasicData>
        <BasicData
          className="rounded-r-lg flex-1 justify-center lg:justify-start"
          title="Available for collection"
        >
          ${commify(702.01)}
        </BasicData>
      </div>

      <Typography.Body className="mt-10">Drip rate</Typography.Body>
      <Typography.Body3 className="text-sm text-table-title mt-3">
        Sentence or two about Dripper funds. Either that or use tooltips below
      </Typography.Body3>
      <div className="w-full lg:w-3/4 max-w-[818px] flex mt-6">
        <BasicData
          className="rounded-l-lg flex-1 justify-center lg:justify-start"
          title="Per day"
          info={false}
        >
          ${commify(1529)}
        </BasicData>
        <BasicData
          className="flex-1 justify-center lg:justify-start"
          title="Per hour"
          info={false}
        >
          ${commify(63.71)}
        </BasicData>
        <BasicData
          className="rounded-r-lg flex-1 justify-center lg:justify-start"
          title="Per minute"
          info={false}
        >
          ${commify(1.0618)}
        </BasicData>
      </div>
    </Section>
  );
};

export default DripperBasicStats;
