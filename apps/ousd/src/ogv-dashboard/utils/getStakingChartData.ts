import { ChartData } from "chart.js";
import {
  priceGradientStart,
  fill,
  tension,
  pointRadius,
  pointHitRadius,
  pointHoverRadius,
  pointHoverBorderWidth,
  pointHoverBorderColor,
} from "../../constants";
import { stakingGradientEnd } from "../constants";
import { GetStorageAtResponse } from "../types";
import { BigNumber, utils } from "ethers";
const { formatUnits } = utils;

/* First `days` elements of rawStakingData are the staking balances, next `days`
 * elements are the total supplies, and final `days` elements are the timestamps
 * of the blocks those metric were measured in... all over the last `days` days.
 */
const getStakingChartData = (rawStakingData: any[], days: number) => {
  const fullData = rawStakingData
    .slice(0, days)
    .map((d: GetStorageAtResponse, i: number) =>
      // Maintains two decimals of precision in the percentage
      {
        const amount = BigNumber.from(d.result);
        const percentage =
          amount
            .mul(10000)
            .div(
              BigNumber.from(
                // Getting total supplies
                (rawStakingData[i + days] as GetStorageAtResponse).result
              )
            )
            .toNumber() / 100;

        const time =
          BigNumber.from(
            rawStakingData[i + days * 2].result.timestamp
          ).toNumber() * 1000;

        return {
          time,
          amount: parseInt(formatUnits(amount)),
          percentage,
        };
      }
    );

  const stakingData: ChartData<"line"> = {
    datasets: [
      {
        label: "Amount Staked",
        //@ts-ignore
        data: fullData,
        fill,
        tension,
        pointRadius,
        pointHitRadius,
        pointHoverRadius,
        pointHoverBorderWidth,
        pointHoverBorderColor,
        pointHoverBackgroundColor: stakingGradientEnd,
        parsing: {
          xAxisKey: "time",
          yAxisKey: "amount",
        },
      },
    ],
  };

  return stakingData;
};

export default getStakingChartData;
