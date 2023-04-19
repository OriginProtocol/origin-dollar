import React, { forwardRef } from "react";
import Gradient2Button from "../../components/Gradient2Button";
import {
  Chart as ChartJS,
  CategoryScale,
  Tooltip,
  TimeScale,
  BarElement,
  ChartData,
  ChartOptions,
} from "chart.js";
import { barOptions } from "../chart-configs";
import { tailwindConfig } from "../../utils";
import { createTooltip } from "../utils";
import { twMerge } from "tailwind-merge";
import { Typography } from "@originprotocol/origin-storybook";
import { Bar } from "react-chartjs-2";
import { commify } from "ethers/lib/utils";

ChartJS.register(CategoryScale, TimeScale, BarElement, Tooltip);

const colors = tailwindConfig.theme.colors;

interface DripperGraphProps {
  setTime?: boolean;
  graphId: number;
  title: string;
  extraOptions?: Partial<ChartOptions<"bar">>;
  extraData?: {
    title: string;
    value: string;
  }[];
  className?: string;
  bgClassName?: string;
}

enum ChartTime {
  SEVEN_DAY = 7,
  THIRTY_DAY = 30,
  ONE_YEAR = 365,
}

const dataX = [];
const dataY = [];

for (let i = 0; i < 30; i++) {
  dataX.push(Date.now() + i * 24 * 60 * 60 * 1000);
  dataY.push(((Math.random() * 100000) % 1500) + 2500);
}

const DripperGraph = forwardRef<ChartJS<"bar">, DripperGraphProps>(
  (
    {
      setTime = true,
      graphId,
      title,
      extraOptions,
      extraData,
      className,
      bgClassName,
    },
    ref
  ) => {
    const [chartTime, setChartTime] = React.useState<ChartTime>(
      ChartTime.SEVEN_DAY
    );

    const chartData: ChartData<"bar"> = {
      labels: dataX,
      datasets: [
        {
          label: "Yield Earned",
          data: dataY,
          backgroundColor: colors["origin-bg-black"],
          borderColor: colors["origin-blue"],
          borderWidth: 2,
          borderRadius: 100,
          borderSkipped: false,
          hoverBackgroundColor: colors["origin-blue"],
          hoverBorderColor: colors["origin-blue"],
        },
      ],
    };

    // Can't have all the options pointing to the same address in memory
    const options = barOptions(extraOptions);

    options.plugins.tooltip.external = createTooltip(graphId);

    if (bgClassName)
      chartData.datasets[0].backgroundColor = colors[bgClassName.substring(3)];

    return (
      <div
        className={twMerge(
          "bg-origin-bg-black rounded-lg w-full lg:w-[825px] relative mx-auto",
          className,
          bgClassName
        )}
      >
        {/* Yield In/Out Basic Data */}
        <div className="p-3 md:p-6 pb-0 flex justify-between">
          <div>
            <Typography.Body>{title}</Typography.Body>
            <Typography.Body3 className="text-sm text-table-title mt-2">
              Jan 29 2024
            </Typography.Body3>
          </div>

          <div
            className={`${setTime ? "visible" : "invisible"} p-0 lg:p-2 flex`}
          >
            <Gradient2Button
              onClick={() => setChartTime(ChartTime.SEVEN_DAY)}
              outerDivClassName={`rounded-lg ${
                chartTime === ChartTime.SEVEN_DAY
                  ? "bg-gradient2"
                  : twMerge("bg-origin-bg-black", bgClassName)
              } mr-2`}
              className={`text-xs md:text-base rounded-lg px-1 sm:px-3 py-[5.5px] lg:px-7 lg:py-3 ${
                chartTime === ChartTime.SEVEN_DAY
                  ? "bg-[#1b1a1abb]"
                  : twMerge("bg-origin-bg-black", bgClassName)
              }`}
            >
              7D
            </Gradient2Button>

            <Gradient2Button
              onClick={() => setChartTime(ChartTime.THIRTY_DAY)}
              outerDivClassName={`rounded-lg ${
                chartTime === ChartTime.THIRTY_DAY
                  ? "bg-gradient2"
                  : twMerge("bg-origin-bg-black", bgClassName)
              } mr-2`}
              className={`text-xs md:text-base rounded-lg px-1 sm:px-3 py-[5.5px] lg:px-7 lg:py-3 ${
                chartTime === ChartTime.THIRTY_DAY
                  ? "bg-[#1b1a1abb]"
                  : twMerge("bg-origin-bg-black", bgClassName)
              }`}
            >
              30D
            </Gradient2Button>
            <Gradient2Button
              onClick={() => setChartTime(ChartTime.ONE_YEAR)}
              outerDivClassName={`rounded-lg ${
                chartTime === ChartTime.ONE_YEAR
                  ? "bg-gradient2"
                  : twMerge("bg-origin-bg-black", bgClassName)
              } mr-2`}
              className={`text-xs md:text-base rounded-lg px-1 sm:px-3 py-[5.5px] lg:px-7 lg:py-3 ${
                chartTime === ChartTime.ONE_YEAR
                  ? "bg-[#1b1a1abb]"
                  : twMerge("bg-origin-bg-black", bgClassName)
              }`}
            >
              365D
            </Gradient2Button>
          </div>
        </div>
        <div className="pb-2 lg:pb-6">
          <Typography.H7 className=" text-sm md:text-base inline mr-2 pl-3 md:pl-6">
            {" "}
            ${commify(2500.36)}
          </Typography.H7>
          {extraData?.map((data, i) => (
            // Static Array, key={i} ok
            <div key={i} className="inline mr-3">
              <Typography.Body3 className="text-xs md:text-sm inline mr-1">
                {data.value}
              </Typography.Body3>
              <Typography.Body3 className="text-xs md:text-sm text-table-title inline">
                {data.title}
              </Typography.Body3>
            </div>
          ))}
        </div>
        {/* Yield In/Out Chart */}
        <div
          className="relative h-[165px] md:h-[215px]"
          id={"dripper-chart" + graphId}
        >
          <Bar ref={ref} data={chartData} options={options} />
        </div>
      </div>
    );
  }
);

DripperGraph.displayName = "DripperGraph";
export default DripperGraph;
