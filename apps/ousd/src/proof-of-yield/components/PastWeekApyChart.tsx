import React from "react";
import { ChartData } from "chart.js";
import { lineOptions } from "../chart-configs";
import {
  priceGradientStart,
  fill,
  tension,
  pointRadius,
  pointHitRadius,
  pointHoverRadius,
  pointHoverBorderWidth,
  pointHoverBorderColor,
  priceGradientEnd,
} from "../../constants";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  PointElement,
  LineElement,
  LinearScale,
} from "chart.js";
import { useChartGradient } from "../../hooks";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);
interface PastWeekApyChartProps {
  data: number[][];
}

const PastWeekApyChart = ({ data }: PastWeekApyChartProps) => {
  const xVals = data.map((e) => e[0]);
  const yVals = data.map((e) => e[1]);

  const rawChartConfig: ChartData<"line", number[], number> = {
    labels: xVals,
    datasets: [
      {
        label: "Price",
        data: yVals,
        fill,
        tension: 0.1,
        pointRadius,
        borderWidth: 1,
        pointHitRadius,
        pointHoverRadius,
        pointHoverBorderWidth,
        pointHoverBorderColor,
        backgroundColor: priceGradientStart,
      },
    ],
  };

  const { chartRef, chartData } = useChartGradient(
    rawChartConfig,
    priceGradientStart,
    priceGradientEnd
  );

  return (
    <div className="relative max-h-[44px] max-w-[120px]">
      <Line ref={chartRef} data={chartData} options={lineOptions} />
    </div>
  );
};

export default PastWeekApyChart;
