import React from "react";
import { Section } from "../../components";
import { Typography } from "@originprotocol/origin-storybook";
import { ChartData } from "chart.js";
import { Line } from "react-chartjs-2";
import { stakeLineOptions } from "../chart-configs";
import { useChartGradient } from "../../hooks";
import { stakingGradientStart, stakingGradientEnd } from "../constants";
import { utils } from "ethers";
const { commify } = utils;

interface OgvStakingStatsProps {
  stakingData: ChartData<"line">;
}

const OgvStakingStats = ({ stakingData }: OgvStakingStatsProps) => {
  const { chartRef, chartData: chartStakingData } = useChartGradient(
    stakingData,
    stakingGradientStart,
    stakingGradientEnd
  );

  return (
    <Section className="bg-origin-bg-black">
      <Typography.H3 className="mt-20 px-[24px] sm:px-0">
        OGV staking stats
      </Typography.H3>
      <Typography.Body className="mt-6 text-subheading px-[24px] sm:px-0">
        A significant portion of the OGV supply is locked voluntarily by holders
        who believe in the long-term growth of OUSD. OGV stakers receive fees
        and governance power in exchange for their commitment to the protocol.
      </Typography.Body>

      <div className="border-2 border-gray-700 w-full my-12 rounded-lg grid grid-cols-1 sm:grid-cols-2">
        <div className="h-[100px] sm:h-[156px] flex justify-center items-center border-gray-700 border-b-2 sm:border-b-0 sm:border-r-2">
          <div className="flex justify-center items-center flex-col sm:block">
            <Typography.Body className="text-subheading mb-1">
              Amount currently staked
            </Typography.Body>
            <Typography.H6 className="font-bold md:text-3xl">
              {/* @ts-ignore */}
              {commify(stakingData.datasets[0].data[0].amount)}
            </Typography.H6>
          </div>
        </div>
        <div className="h-[100px] sm:h-[156px] flex justify-center items-center">
          <div className="flex justify-center items-center flex-col sm:block">
            <Typography.Body className="text-subheading mb-1">
              Percentage staked
            </Typography.Body>
            <Typography.H6 className="font-bold md:text-3xl">
              {/* @ts-ignore */}
              {`${commify(stakingData.datasets[0].data[0].percentage)}%`}
            </Typography.H6>
          </div>
        </div>
      </div>

      <Typography.H7>Amount of OGV staked</Typography.H7>
      <div id="ogv-staking-chart" className="relative">
        <Line
          className="my-6 border-2 border-origin-border rounded-lg !w-full !h-[120vw] sm:!h-[60vw] max-h-[35rem]"
          ref={chartRef}
          data={chartStakingData}
          options={stakeLineOptions}
        />
      </div>
    </Section>
  );
};

export default OgvStakingStats;
