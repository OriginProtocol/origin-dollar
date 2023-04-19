import { Chart as ChartJS, ChartData, ChartDataset, Point } from "chart.js";
import { useState, useEffect, useRef } from "react";
import { createGradient } from "../utils";

export const useChartGradient = (
  data: ChartData<"line"> | (() => ChartData<"line">),
  colorStart: string,
  colorEnd: string
) => {
  const chartRef = useRef<ChartJS<"line">>(null);
  const [chartData, setChartData] = useState<ChartData<"line">>(data);

  useEffect(() => {
    if (!chartRef.current) return;

    if (typeof data === "function") data = data();

    // Gradient insertion will need to be done client-side
    const chartData = {
      ...data,
      datasets: data.datasets.map(
        (e: ChartDataset<"line", (number | Point)[]>) => ({
          ...e,
          // Need a deep copy for chart updating to animate correctly
          data: [...e.data],
          borderColor: createGradient(
            chartRef.current.ctx,
            chartRef.current.chartArea,
            colorStart,
            colorEnd
          ),
        })
      ),
    };

    setChartData(chartData);
  }, []);

  return { chartRef, chartData };
};

export default useChartGradient;
