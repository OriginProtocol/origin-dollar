import React, { useState, useEffect } from "react";
import { Section } from "../../components";
import { ChartButton } from "../components";
import { ChartTime, ChartType, OgvRawData } from "../types";
import { priceGradientStart, priceGradientEnd } from "../../constants";
import { smSize } from "../../constants";
import { getOGVPriceData, setCacheData } from "../utils";
import { useChartGradient } from "../../hooks";
import { ChartData, TimeScaleOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { priceLineOptions } from "../chart-configs";

interface OgvPriceChartProps {
  priceData24H: ChartData<"line", number[], number>;
  marketCapData24H: ChartData<"line", number[], number>;
  rawData7D: OgvRawData;
  rawData30D: OgvRawData;
  rawData365D: OgvRawData;
  width: number;
}

const OgvPriceChart = ({
  priceData24H,
  marketCapData24H,
  rawData7D,
  rawData30D,
  rawData365D,
  width,
}: OgvPriceChartProps) => {
  const { chartRef, chartData: chartPriceData24H } = useChartGradient(
    priceData24H,
    priceGradientStart,
    priceGradientEnd
  );
  const [chartType, setChartType] = useState<ChartType>(ChartType.Price);
  const [chartTime, setChartTime] = useState<ChartTime>(ChartTime.ONE_DAY);

  const alterChartType = async (type: ChartType) => {
    const { current: chart } = chartRef;

    if (!chart) return;

    const { labels, prices, marketCaps } = await getOGVPriceData(chartTime);

    const newData = chartType === ChartType.Price ? marketCaps : prices;
    chart.data.datasets[0].data = newData;
    chart.data.labels = labels;
    // change label on chart
    chart.data.datasets[0].label =
      type === ChartType.Price ? "Price" : "Market Cap";

    chart.update();

    setChartType(type);
  };

  const alterChartTime = async (time: ChartTime) => {
    const { current: chart } = chartRef;

    if (!chart) return;

    const { labels, prices, marketCaps } = await getOGVPriceData(time);

    const newData = chartType === ChartType.Price ? prices : marketCaps;
    chart.data.datasets[0].data = newData;
    chart.data.labels = labels;

    let { displayFormats } = (chart.options.scales.x as TimeScaleOptions).time;
    if (time === ChartTime.ONE_DAY) displayFormats.hour = "HH:mm";
    else {
      displayFormats.hour = "MM/dd";
      displayFormats.day = "MM/dd";
    }

    chart.update();

    setChartTime(time);
  };

  useEffect(() => {
    setCacheData(ChartTime.ONE_DAY, {
      labels: priceData24H.labels,
      prices: priceData24H.datasets[0].data,
      marketCaps: marketCapData24H.datasets[0].data,
    });
    setCacheData(ChartTime.SEVEN_DAY, rawData7D);
    setCacheData(ChartTime.THIRTY_DAY, rawData30D);
    setCacheData(ChartTime.ONE_YEAR, rawData365D);
  }, [priceData24H, marketCapData24H]);

  return (
    <Section className="bg-origin-bg-black">
      <div className="mt-20">
        <div className="flex justify-between">
          <div className="flex">
            <ChartButton
              onClick={() => alterChartType(ChartType.Price)}
              selectCondition={chartType === ChartType.Price}
            >
              Price
            </ChartButton>
            <ChartButton
              onClick={() => alterChartType(ChartType.Market_Cap)}
              className={`w-28 md:w-32 `}
              selectCondition={chartType === ChartType.Market_Cap}
            >
              Market Cap
            </ChartButton>
          </div>

          {width >= smSize && (
            <TimeButtons
              chartTime={chartTime}
              alterChartTime={alterChartTime}
            />
          )}
        </div>
      </div>

      <div id="ogv-price-chart" className="relative">
        <Line
          className="my-6 border-2 border-origin-border rounded-lg !w-full !h-[120vw] sm:!h-[40vw] max-h-[30rem]"
          ref={chartRef}
          data={chartPriceData24H}
          options={priceLineOptions}
        />
      </div>

      {width < smSize && (
        <TimeButtons chartTime={chartTime} alterChartTime={alterChartTime} />
      )}
    </Section>
  );
};

interface TimeButtonsProps {
  chartTime: ChartTime;
  alterChartTime: (chartTime: ChartTime) => void;
}

const TimeButtons = ({ chartTime, alterChartTime }: TimeButtonsProps) => {
  return (
    <div className="mt-8 sm:mt-0 flex">
      <ChartButton
        onClick={() => alterChartTime(ChartTime.ONE_DAY)}
        selectCondition={chartTime === ChartTime.ONE_DAY}
      >
        24H
      </ChartButton>
      <ChartButton
        onClick={() => alterChartTime(ChartTime.SEVEN_DAY)}
        selectCondition={chartTime === ChartTime.SEVEN_DAY}
      >
        7D
      </ChartButton>
      <ChartButton
        onClick={() => alterChartTime(ChartTime.THIRTY_DAY)}
        selectCondition={chartTime === ChartTime.THIRTY_DAY}
      >
        30D
      </ChartButton>
      <ChartButton
        onClick={() => alterChartTime(ChartTime.ONE_YEAR)}
        selectCondition={chartTime === ChartTime.ONE_YEAR}
      >
        365D
      </ChartButton>
    </div>
  );
};

export default OgvPriceChart;
