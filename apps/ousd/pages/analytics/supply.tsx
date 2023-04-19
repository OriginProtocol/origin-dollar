import Head from "next/head";
import {
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
} from "../../src/components";
import { GetServerSideProps } from "next";
import { groupBy } from "lodash";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  TimeScale,
  Title,
  Tooltip,
} from "chart.js";
import { Typography } from "@originprotocol/origin-storybook";
import { useQuery } from "react-query";
import { useMemo, useState } from "react";
import { createGradient } from "../../src/analytics/utils";
import { last } from "lodash";
import { DurationFilter } from "../../src/analytics/components";
import { useSupplyDistributionChart } from "../../src/analytics/hooks/useSupplyDistributionChart";

ChartJS.register(
  CategoryScale,
  TimeScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  ArcElement,
  RadialLinearScale,
  Filler,
  Legend
);

const SupplyAggregate = () => {
  return (
    <div className="flex flex-col space-y-1">
      <LayoutBox className="rounded-bl-none rounded-br-none h-[135px]">
        <div className="flex flex-col p-8 space-y-2">
          <Typography.Caption className="text-subheading">
            Total Supply
          </Typography.Caption>
          <Typography.Body>$60,575,325</Typography.Body>
        </div>
      </LayoutBox>
      <LayoutBox className="rounded-none h-[135px]">
        <div className="flex flex-col p-8 space-y-2">
          <Typography.Caption className="text-subheading">
            Rebasing Supply
          </Typography.Caption>
          <Typography.Body>$60,575,325</Typography.Body>
        </div>
      </LayoutBox>
      <LayoutBox className="rounded-tl-none rounded-tr-none h-[135px]">
        <div className="flex flex-col p-8 space-y-2">
          <Typography.Caption className="text-subheading">
            Non-Rebasing Supply
          </Typography.Caption>
          <Typography.Body>$60,575,325</Typography.Body>
        </div>
      </LayoutBox>
    </div>
  );
};

const SupplyDistribution = () => {
  const [{ data, chartOptions, detailed }] = useSupplyDistributionChart();
  const { rebasing, nonRebasing } = groupBy(detailed, "type");
  return (
    <LayoutBox loadingClassName="flex items-center justify-center w-full h-[413px]">
      <div className="flex flex-row justify-between w-full h-[80px] p-4 md:p-6">
        <div className="flex flex-col w-full h-full">
          <Typography.Caption>
            Current total Supply breakdown
          </Typography.Caption>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full pb-4">
        <div className="flex flex-col items-center justify-center flex-shrink-0 w-full h-[310px] px-6">
          <Doughnut options={chartOptions} data={data} />
        </div>
        <div className="flex flex-col flex-shrink-0 w-full h-full space-y-4 px-6">
          <div className="flex flex-col bg-origin-bg-black bg-opacity-50 rounded-md p-4 space-y-2">
            <Typography.Caption>Rebasing Supply</Typography.Caption>
            {rebasing.map(({ label, color, totalDisplay }) => (
              <div key={label} className="flex flex-row space-x-4">
                <div
                  className="relative top-[6px] flex items-start w-[8px] h-[8px] rounded-full"
                  style={{
                    background: color,
                  }}
                />
                <div className="flex flex-row justify-between w-full">
                  <Typography.Caption>{label}</Typography.Caption>
                  <Typography.Caption className="text-subheading">
                    {totalDisplay}
                  </Typography.Caption>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col bg-origin-bg-black bg-opacity-50 rounded-md p-4 space-y-2">
            <Typography.Caption>Non-rebasing Supply</Typography.Caption>
            {nonRebasing.map(({ label, color, totalDisplay }) => (
              <div key={label} className="flex flex-row space-x-4">
                <div
                  className="relative top-[6px] flex items-start w-[8px] h-[8px] rounded-full"
                  style={{
                    background: color,
                  }}
                />
                <div className="flex flex-row justify-between w-full">
                  <Typography.Caption>{label}</Typography.Caption>
                  <Typography.Caption className="text-subheading">
                    {totalDisplay}
                  </Typography.Caption>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LayoutBox>
  );
};

const SupplyBreakdown = () => {
  const { data, isFetching } = useQuery("/api/analytics/charts/totalSupply", {
    initialData: {
      labels: [],
      datasets: [],
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const chartData = useMemo(() => {
    return {
      labels: data?.labels,
      datasets: data?.datasets?.reduce((acc, dataset) => {
        if (!chartState?.typeOf || dataset.id === chartState?.typeOf) {
          acc.push({
            ...dataset,
            borderWidth: 0,
            backgroundColor: createGradient(["#8C66FC", "#0274F1"]),
            fill: true,
          });
        }
        return acc;
      }, []),
    };
  }, [JSON.stringify(data), chartState?.duration, chartState?.typeOf]);

  const labels = [];

  return (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[370px] w-full"
      isLoading={isFetching}
    >
      <div className="flex flex-row justify-between w-full h-[160px] p-4 md:p-6">
        <div className="flex flex-col w-full h-full">
          <Typography.Caption className="text-subheading">
            Collateral
          </Typography.Caption>
          <div className="flex flex-col text-sm my-2 space-y-1">
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-[#FBC247] rounded-full" />
              <Typography.Caption className="text-subheading">
                DAI
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-gradient2 rounded-full" />
              <Typography.Caption className="text-subheading">
                USDC
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-gradient2 rounded-full" />
              <Typography.Caption className="text-subheading">
                USDT
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
          </div>
          <Typography.Caption className="text-subheading">
            {last(chartData?.labels)}
          </Typography.Caption>
        </div>
        <div className="flex flex-col space-y-2">
          <DurationFilter
            value={chartState?.duration}
            onChange={(duration) => {
              setChartState((prev) => ({
                ...prev,
                duration: duration || "all",
              }));
            }}
          />
        </div>
      </div>
      <div className="mr-6 h-[320px]">
        <Bar
          options={{
            plugins: {
              title: {
                display: true,
                text: "Chart.js Bar Chart - Stacked",
              },
            },
            responsive: true,
            scales: {
              x: {
                stacked: true,
              },
              y: {
                stacked: true,
              },
            },
          }}
          data={{
            labels,
            datasets: [
              {
                label: "Dataset 1",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(255, 99, 132)",
              },
              {
                label: "Dataset 2",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(75, 192, 192)",
              },
              {
                label: "Dataset 3",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(53, 162, 235)",
              },
            ],
          }}
        />
      </div>
    </LayoutBox>
  );
};

const SupplyVolumeBreakdown = () => {
  const { data, isFetching } = useQuery("/api/analytics/charts/totalSupply", {
    initialData: {
      labels: [],
      datasets: [],
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const chartData = useMemo(() => {
    return {
      labels: data?.labels,
      datasets: data?.datasets?.reduce((acc, dataset) => {
        if (!chartState?.typeOf || dataset.id === chartState?.typeOf) {
          acc.push({
            ...dataset,
            borderWidth: 0,
            backgroundColor: createGradient(["#8C66FC", "#0274F1"]),
            fill: true,
          });
        }
        return acc;
      }, []),
    };
  }, [JSON.stringify(data), chartState?.duration, chartState?.typeOf]);

  const labels = [];

  return (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[370px] w-full"
      isLoading={isFetching}
    >
      <div className="flex flex-row justify-between w-full h-[160px] p-4 md:p-6">
        <div className="flex flex-col w-full h-full">
          <Typography.Caption className="text-subheading">
            Collateral
          </Typography.Caption>
          <div className="flex flex-col text-sm my-2 space-y-1">
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-[#FBC247] rounded-full" />
              <Typography.Caption className="text-subheading">
                DAI
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-gradient2 rounded-full" />
              <Typography.Caption className="text-subheading">
                USDC
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
            <div className="flex flex-row items-center space-x-2">
              <div className="w-[6px] h-[6px] bg-gradient2 rounded-full" />
              <Typography.Caption className="text-subheading">
                USDT
              </Typography.Caption>
              <Typography.Caption>$14,380,104</Typography.Caption>
              <Typography.Caption className="text-subheading pl-2">
                26.38%
              </Typography.Caption>
            </div>
          </div>
          <Typography.Caption className="text-subheading">
            {last(chartData?.labels)}
          </Typography.Caption>
        </div>
        <div className="flex flex-col space-y-2">
          <DurationFilter
            value={chartState?.duration}
            onChange={(duration) => {
              setChartState((prev) => ({
                ...prev,
                duration: duration || "all",
              }));
            }}
          />
        </div>
      </div>
      <div className="mr-6 h-[320px]">
        <Bar
          options={{
            plugins: {
              title: {
                display: true,
                text: "Chart.js Bar Chart - Stacked",
              },
            },
            responsive: true,
            scales: {
              x: {
                stacked: true,
              },
              y: {
                stacked: true,
              },
            },
          }}
          data={{
            labels,
            datasets: [
              {
                label: "Dataset 1",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(255, 99, 132)",
              },
              {
                label: "Dataset 2",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(75, 192, 192)",
              },
              {
                label: "Dataset 3",
                data: labels.map(() => Math.random() * 1000),
                backgroundColor: "rgb(53, 162, 235)",
              },
            ],
          }}
        />
      </div>
    </LayoutBox>
  );
};

const AnalyticsSupply = () => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Supply</title>
      </Head>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-3">
          <SupplyAggregate />
        </div>
        <div className="col-span-12 xl:col-span-9">
          <SupplyDistribution />
        </div>
        <div className="col-span-12">
          <SupplyBreakdown />
        </div>
        <div className="col-span-12">
          <SupplyVolumeBreakdown />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props;
}> => {
  return {
    props: {},
  };
};

export default AnalyticsSupply;

AnalyticsSupply.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
