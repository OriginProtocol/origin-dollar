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
import { OgvRawData } from "../types";

const get24HChartData = (rawData24H: OgvRawData) => {
  const { labels, prices, marketCaps } = rawData24H;

  const priceData24H: ChartData<"line", number[], number> = {
    labels,
    datasets: [
      {
        label: "Price",
        data: prices,
        fill,
        tension,
        pointRadius,
        pointHitRadius,
        pointHoverRadius,
        pointHoverBorderWidth,
        pointHoverBorderColor,
        pointHoverBackgroundColor: priceGradientStart,
      },
    ],
  };

  const marketCapData24H: ChartData<"line", number[], number> = {
    labels,
    datasets: [
      {
        label: "Market Cap",
        data: marketCaps,
        fill: false,
        tension,
        pointRadius,
      },
    ],
  };

  return { priceData24H, marketCapData24H };
};

export default get24HChartData;
