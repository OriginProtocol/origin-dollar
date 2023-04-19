import React from "react";
import { Section } from "../../components";
import { Typography } from "@originprotocol/origin-storybook";
import { utils } from "ethers";
import { doughnutOptions } from "../chart-configs";
import { Doughnut } from "react-chartjs-2";
import { ChartData } from "chart.js";

interface AllocationDistributionProps {
  doughnutData: ChartData<"doughnut", number[], unknown>;
}

const AllocationDistribution = ({
  doughnutData,
}: AllocationDistributionProps) => {
  return (
    <Section className="bg-origin-bg-black">
      <Typography.H3 className="mt-[120px] px-[24px] sm:px-0">
        OGV allocation
      </Typography.H3>
      <Typography.Body className="text-subheading mt-4 px-[24px] sm:px-0">
        Initial allocation at launch
      </Typography.Body>
      <div className="flex flex-col xl:flex-row items-center my-14 sm:my-20 relative">
        <div className="relative h-80 w-80 sm:h-120 sm:w-120 mb-4 xl:mr-28">
          <Doughnut options={doughnutOptions} data={doughnutData} />
          <p className="absolute font-bold text-xl sm:text-3xl top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%]">
            {utils.commify(doughnutData.datasets[0].label)}
          </p>
        </div>
        <div className="h-80 w-80 sm:h-120 sm:w-120 xl:mr-10 absolute flex justify-center items-center"></div>
        <div id="legend-container" className="inline-block w-80 sm:w-120" />
      </div>
    </Section>
  );
};

export default AllocationDistribution;
