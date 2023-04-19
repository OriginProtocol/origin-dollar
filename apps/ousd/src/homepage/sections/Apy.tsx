import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import zipObject from "lodash/zipObject";
import useApyHistoryQuery from "../../queries/useApyHistoryQuery";
import { Chart as ChartJS } from "chart.js/auto";
import { LineChart } from "../components";
import { Typography } from "@originprotocol/origin-storybook";
import { formatCurrency } from "../../utils/math";
import { apyDayOptions } from "../../utils/constants";
import { CategoryScale } from "chart.js";
import { Section } from "../../components";
import { ApyHistory } from "../types";
import { twMerge } from "tailwind-merge";
import { Dictionary } from "lodash";

ChartJS.register(CategoryScale);

interface ApyProps {
  daysToApy: Dictionary<number>;
  apyData: ApyHistory;
  sectionOverrideCss?: string;
}

const Apy = ({ daysToApy, apyData, sectionOverrideCss }: ApyProps) => {
  const [loaded, setLoaded] = useState(false);
  const [apyDays, setApyDays] = useState(
    process.browser &&
      localStorage.getItem("last_user_selected_apy") !== null &&
      apyDayOptions.includes(
        Number(localStorage.getItem("last_user_selected_apy"))
      )
      ? Number(localStorage.getItem("last_user_selected_apy"))
      : 30
  );

  const apyHistoryQuery = useApyHistoryQuery(apyData);

  const apyHistory = useMemo(
    () => apyHistoryQuery.data,
    [apyHistoryQuery.isSuccess, apyHistoryQuery.data]
  );

  const [chartData, setChartData] = useState();
  const dataReversed =
    apyHistory && apyHistory[`apy${apyDays}`]
      ? apyHistory[`apy${apyDays}`]
      : [];
  const data = dataReversed.slice().reverse();

  useEffect(() => {
    apyHistoryQuery.refetch();
  }, []);

  useEffect(() => {
    localStorage.setItem("last_user_selected_apy", String(apyDays));
    setLoaded(true);
  }, [apyDays]);

  let width, height, gradient;
  function getGradient(ctx, chartArea) {
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    if (!gradient || width !== chartWidth || height !== chartHeight) {
      width = chartWidth;
      height = chartHeight;
      gradient = ctx.createLinearGradient(
        0,
        chartArea.left,
        chartArea.right,
        0
      );
      gradient.addColorStop(0, "#8c66fc");
      gradient.addColorStop(1, "#0274f1");
    }
    return gradient;
  }

  useEffect(() => {
    if (data.length === 0) return;
    else {
      setChartData({
        // @ts-ignore
        label: "APY",
        labels: data.map((d) => new Date(d.day).toString().slice(4, 10)),
        datasets: [
          {
            data: data.map((d) => d.trailing_apy),
            borderColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;

              if (!chartArea) {
                return;
              }
              return getGradient(ctx, chartArea);
            },
            borderWidth: 5,
            tension: 0,
            borderJoinStyle: "round",
            pointRadius: 0,
            pointHitRadius: 1,
          },
        ],
      });
    }
  }, [apyHistory, apyDays]);

  return (
    <Section
      className={twMerge("bg-origin-bg-grey text-center", sectionOverrideCss)}
      innerDivClassName="py-14 md:py-[120px]"
    >
      <Typography.H6
        className="text-[32px] md:text-[56px] leading-[36px] md:leading-[64px]"
        style={{ fontWeight: 500 }}
      >
        A high-yield, <span className="text-gradient2 py-1">low-risk </span>
        DeFi strategy
      </Typography.H6>
      <Typography.Body3 className="md:max-w-[943px] mt-[16px] mx-auto leading-[28px] text-subheading">
        Grow your stablecoin portfolio by swapping USDC, USDT, or DAI to OUSD.
        Yields are generated on-chain, distributed directly to your wallet, and
        compounded automatically. Your funds are never risked on speculative
        positions.
      </Typography.Body3>
      {loaded && (
        <div className="max-w-[1432px] mx-auto flex flex-col mt-20 mb-10 md:mb-20 p-[16px] md:p-10 rounded-xl bg-[#141519]">
          <div className="flex flex-col lg:flex-row justify-between">
            <div className="mt-[0px] md:mt-[16px]">
              <Typography.H2 className="font-bold xl:inline lg:text-left">
                {formatCurrency(
                  // @ts-ignore
                  daysToApy[apyDays] * 100,
                  2
                ) + "% "}
              </Typography.H2>
              <Typography.H7 className="text-sm font-normal md:text-2xl text-subheading mt-[4px] xl:mt-0 xl:inline lg:text-left opacity-70">{`Trailing ${apyDays}-day APY`}</Typography.H7>
            </div>
            <div className="flex flex-col w-[286px] sm:w-[425px] mt-6 lg:mt-0 mx-[auto] lg:mx-0">
              <Typography.Body3 className="text-sm md:text-base text-subheading">
                Moving average
              </Typography.Body3>
              <div className="flex flex-row justify-between mt-[12px]">
                {apyDayOptions.map((days) => {
                  return (
                    <div
                      className={`${
                        apyDays === days ? "gradient2" : "bg-[#1e1f25]"
                      } w-[90px] sm:w-[135px] p-px rounded-lg text-center cursor-pointer hover:opacity-90`}
                      key={days}
                      onClick={() => {
                        setApyDays(days);
                      }}
                    >
                      <div className="bg-[#1e1f25] w-full h-full rounded-lg">
                        <div
                          className={`w-full h-full py-[14px] rounded-lg ${
                            apyDays === days ? "gradient4" : "text-subheading"
                          }`}
                        >
                          <Typography.Body3
                            className={`${
                              apyDays === days
                                ? "text-[#fafbfb] font-medium"
                                : "text-subheading"
                            }`}
                          >{`${days}-day`}</Typography.Body3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {chartData && (
            <div className="mt-12 -mr-[16px] -ml-[16px] md:ml-[0px]">
              <LineChart chartData={chartData} />
            </div>
          )}
        </div>
      )}
      <Link
        href={`${process.env.NEXT_PUBLIC_DAPP_URL}`}
        target="_blank"
        className="bttn gradient2"
      >
        <Typography.H7 className="font-normal">Start earning now</Typography.H7>
      </Link>
    </Section>
  );
};

export default Apy;
