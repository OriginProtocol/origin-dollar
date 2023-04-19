import React, { useMemo } from "react";
import Head from "next/head";
import { Bar } from "react-chartjs-2";
import {
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
} from "../../src/components";
import classnames from "classnames";
import { Typography } from "@originprotocol/origin-storybook";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
} from "chart.js";
import { last } from "lodash";
import {
  DefaultChartHeader,
  DurationFilter,
} from "../../src/analytics/components";
import { useProtocolRevenueChart } from "../../src/analytics/hooks/useProtocolRevenueChart";
import { formatCurrency } from "../../src/utils/math";

ChartJS.register(CategoryScale, LinearScale, BarElement);

const ProtocolRevenueDetails = ({ breakdowns, isFetching }) => {
  return (
    <div className="flex flex-col md:flex-row gap-1 items-center w-full">
      {breakdowns.map(({ label, infoHelp, percentageDiff, display }, index) => (
        <LayoutBox
          key={label}
          isLoading={isFetching}
          className={classnames({
            "rounded-tr-none rounded-br-none w-full h-full": index === 0,
            "rounded-none": index > 0 && index !== breakdowns.length - 1, // middle sections
            "rounded-tl-none rounded-bl-none": index === breakdowns.length - 1,
          })}
        >
          <div className="flex flex-row w-full h-[110px] md:h-[150px] items-center space-x-6 px-6">
            <div className="flex flex-col space-y-1">
              <Typography.Body2 className="relative text-subheading">
                {label}
                {percentageDiff && (
                  <span className="text-white">{<span></span>}</span>
                )}
              </Typography.Body2>
              <Typography.H7>{display}</Typography.H7>
            </div>
          </div>
        </LayoutBox>
      ))}
    </div>
  );
};

const ProtocolChart = ({
  data,
  isFetching,
  onChangeFilter,
  chartOptions,
  filter,
}) => {
  return data ? (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[350px] w-full"
      isLoading={isFetching}
    >
      <div className="flex flex-row justify-between w-full h-[150px] p-4 md:p-6">
        <DefaultChartHeader
          title="Daily Protocol Revenue"
          display={`$${formatCurrency(last(data?.datasets?.[0]?.data), 0)}`}
          date={last(data?.labels)}
        />
        <div className="flex flex-col space-y-2">
          <DurationFilter
            value={filter?.duration}
            onChange={(duration) => {
              onChangeFilter({
                duration: duration || "all",
              });
            }}
          />
        </div>
      </div>
      <div className="mr-6">
        <Bar options={chartOptions} data={data} />
      </div>
    </LayoutBox>
  ) : null;
};

const AnalyticsProtocolRevenue = () => {
  const [
    { data, aggregations, filter, chartOptions, isFetching },
    { onChangeFilter },
  ] = useProtocolRevenueChart();

  const breakdowns = useMemo(() => {
    const {
      dailyRevenue = 0,
      weeklyRevenue = 0,
      allTimeRevenue = 0,
    } = aggregations || {};
    return [
      {
        label: "24H revenue",
        display: `$${formatCurrency(dailyRevenue, 0)}`,
        value: dailyRevenue,
      },
      {
        label: "7D revenue",
        display: `$${formatCurrency(weeklyRevenue, 0)}`,
        value: weeklyRevenue,
      },
      {
        label: "Total revenue",
        display: `$${formatCurrency(allTimeRevenue, 0)}`,
        value: allTimeRevenue,
      },
    ];
  }, [JSON.stringify(data)]);

  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Protocol Revenue</title>
      </Head>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <ProtocolRevenueDetails
            breakdowns={breakdowns}
            isFetching={isFetching}
          />
        </div>
        <div className="col-span-12">
          <ProtocolChart
            data={data}
            filter={filter}
            chartOptions={chartOptions}
            isFetching={isFetching}
            onChangeFilter={onChangeFilter}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AnalyticsProtocolRevenue;

AnalyticsProtocolRevenue.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
