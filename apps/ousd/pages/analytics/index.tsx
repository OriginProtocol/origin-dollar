import Head from 'next/head';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  TimeScale,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { last, orderBy } from 'lodash';
import { Typography } from '@originprotocol/origin-storybook';
import {
  ErrorBoundary,
  LayoutBox,
  TwoColumnLayout,
} from '../../src/components';
import { formatCurrency, formatPercentage } from '../../src/utils/math';
import { aggregateCollateral, chartOptions } from '../../src/analytics/utils';
import {
  DefaultChartHeader,
  DurationFilter,
  MovingAverageFilter,
} from '../../src/analytics/components';
import { useAPYChart } from '../../src/analytics/hooks/useAPYChart';
import { useTotalSupplyChart } from '../../src/analytics/hooks/useTotalSupplyChart';
import { useMarketshareChart } from '../../src/analytics/hooks/useMarketshareChart';
import { GetServerSideProps } from 'next';
import { fetchAllocation } from '../../lib/allocation';
import { fetchCollateral } from '../../lib/collateral';
import { useMemo } from 'react';

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

const APYChartContainer = () => {
  const [{ data, filter, isFetching }, { onChangeFilter }] = useAPYChart();
  return data ? (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[350px] w-full"
      isLoading={isFetching}
    >
      <div className="flex flex-row justify-between w-full h-[150px] p-4 md:p-6">
        <DefaultChartHeader
          title="APY"
          display={`${formatCurrency(
            last(data?.datasets?.[0]?.data) || 0,
            2
          )}%`}
          date={last(data?.labels)}
        />
        <div className="flex flex-col space-y-2">
          <DurationFilter
            value={filter?.duration}
            onChange={(duration) => {
              onChangeFilter({
                duration: duration || 'all',
              });
            }}
          />
          <div className="flex justify-end">
            <MovingAverageFilter
              value={filter?.typeOf}
              onChange={(typeOf) => {
                onChangeFilter({
                  typeOf: typeOf,
                });
              }}
            />
          </div>
        </div>
      </div>
      <div className="mr-6">
        <Line options={chartOptions} data={data} />
      </div>
    </LayoutBox>
  ) : null;
};

const TotalSupplyChartContainer = () => {
  const [{ data, filter, isFetching }, { onChangeFilter }] =
    useTotalSupplyChart();
  return (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[370px] w-full"
      isLoading={isFetching}
    >
      <ErrorBoundary>
        <div className="flex flex-row justify-between w-full h-[210px] p-4 md:p-6">
          <div className="flex flex-col w-full h-full">
            <Typography.Caption className="text-subheading">
              Total Supply
            </Typography.Caption>
            <Typography.H4>{`${formatCurrency(
              last(data?.datasets?.[0]?.data) || 0,
              2
            )}`}</Typography.H4>
            <div className="flex flex-col text-sm mb-2">
              <div className="flex flex-row items-center space-x-2">
                <div className="w-[6px] h-[6px] bg-gradient3 rounded-full" />
                <Typography.Caption className="text-subheading">
                  Circulating OUSD
                </Typography.Caption>
              </div>
              {/*<div className="flex flex-row items-center space-x-2">*/}
              {/*  <div className="w-[6px] h-[6px] bg-gradient2 rounded-full" />*/}
              {/*  <Typography.Caption className="text-subheading">*/}
              {/*    Protocol-owned OUSD*/}
              {/*  </Typography.Caption>*/}
              {/*</div>*/}
            </div>
            <Typography.Caption className="text-subheading">
              {last(data?.labels)}
            </Typography.Caption>
          </div>
          <div className="flex flex-col space-y-2">
            <DurationFilter
              value={filter?.duration}
              onChange={(duration) => {
                onChangeFilter({
                  duration: duration || 'all',
                });
              }}
            />
          </div>
        </div>
        <div className="mr-6">
          <Line options={chartOptions} data={data} />
        </div>
      </ErrorBoundary>
    </LayoutBox>
  );
};

const OUSDMarketshareContainer = () => {
  const [{ data, filter, isFetching }, { onChangeFilter }] =
    useMarketshareChart();
  // @ts-ignore
  return data ? (
    <LayoutBox
      loadingClassName="flex items-center justify-center h-[370px] w-full"
      isLoading={isFetching}
    >
      <ErrorBoundary>
        <div className="flex flex-row justify-between w-full h-[180px] p-4 md:p-6">
          <div className="flex flex-col w-full h-full">
            <DefaultChartHeader
              title="OUSD stablecoin market share on Ethereum"
              display={`${formatCurrency(
                last(data?.datasets?.[0]?.data) || 0,
                4
              )}%`}
              date={last(data?.labels)}
            />
          </div>
          <div className="flex flex-col space-y-2">
            <DurationFilter
              value={filter?.duration}
              onChange={(duration) => {
                onChangeFilter({
                  duration: duration || 'all',
                });
              }}
            />
          </div>
        </div>
        <div className="mr-6">
          <Line options={chartOptions} data={data} />
        </div>
      </ErrorBoundary>
    </LayoutBox>
  ) : null;
};

const CurrentCollateralContainer = ({ data }) => {
  const chartData = useMemo(() => {
    return {
      labels: data.map((item) => item.label),
      datasets: [
        {
          label: 'Current Collateral',
          data: data.map((item) => item.total),
          backgroundColor: data.map((item) => item.color),
          borderWidth: 0,
          hoverOffset: 50,
        },
      ],
    };
  }, []);

  const totalSum = useMemo(() => {
    return data.reduce((acc, item) => {
      acc += Number(item.total || 0);
      return acc;
    }, 0);
  }, [JSON.stringify(data)]);

  return data ? (
    <LayoutBox
      className="min-h-[370px]"
      loadingClassName="flex items-center justify-center w-full h-[370px]"
    >
      <ErrorBoundary>
        <div className="flex flex-row justify-between w-full h-[80px] p-4 md:p-6">
          <div className="flex flex-col w-full h-full">
            <Typography.Caption className="text-subheading">
              Current Collateral
            </Typography.Caption>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full pb-4">
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-full h-[350px] px-6">
            <Doughnut
              options={{
                responsive: true,
                plugins: {
                  title: {
                    display: false,
                  },
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    enabled: false,
                  },
                },
                cutout: '75%',
              }}
              data={chartData}
            />
          </div>
          <div className="flex flex-col flex-shrink-0 w-full h-full space-y-4 px-6">
            {data.map(({ label, color, total }) => (
              <div
                key={label}
                className="flex flex-row bg-origin-bg-black bg-opacity-50 rounded-md p-4"
              >
                <div className="flex flex-row space-x-4">
                  <div
                    className="relative top-[6px] flex items-start w-[8px] h-[8px] rounded-full"
                    style={{
                      background: color,
                    }}
                  />
                  <div className="flex flex-col space-y-1">
                    <Typography.Caption>{label}</Typography.Caption>
                    <Typography.Caption>
                      {formatPercentage(total / totalSum)}
                    </Typography.Caption>
                    <Typography.Caption className="text-subheading">
                      ${formatCurrency(total, 2)}
                    </Typography.Caption>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ErrorBoundary>
    </LayoutBox>
  ) : null;
};

// const CurrentStrategiesChart = () => {
//   return <LayoutBox>Figure out flat doughnut breakdown</LayoutBox>;
// };
//
// const OUSDChart = () => {
//   const { data, isFetching } = useQuery("/api/analytics/charts/ousdPrice", {
//     initialData: {
//       labels: [],
//       datasets: [],
//     },
//     refetchOnWindowFocus: false,
//     keepPreviousData: true,
//   });
//
//   const [chartState, setChartState] = useState({
//     duration: "all",
//   });
//
//   const chartData = useMemo(() => {
//     return {
//       labels: data?.labels,
//       datasets: data?.datasets?.map((dataset) => ({
//         ...dataset,
//         ...borderFormatting,
//         borderColor: createGradient(["#8C66FC", "#0274F1"]),
//       })),
//     };
//   }, [JSON.stringify(data), chartState?.duration]);
//
//   return (
//     <LayoutBox
//       loadingClassName="flex items-center justify-center h-[370px] w-full"
//       isLoading={isFetching}
//     >
//       <div className="flex flex-row justify-between w-full h-[180px] p-4 md:p-6">
//         <div className="flex flex-col w-full h-full">
//           <DefaultChartHeader
//             title="Price"
//             display={`${formatCurrency(
//               last(chartData?.datasets?.[0]?.data) || 0,
//               4
//             )}`}
//             date={last(chartData?.labels)}
//           />
//         </div>
//         <div className="flex flex-col space-y-2">
//           <DurationFilter
//             value={chartState?.duration}
//             onChange={(duration) => {
//               setChartState((prev) => ({
//                 ...prev,
//                 duration: duration || "all",
//               }));
//             }}
//           />
//         </div>
//       </div>
//       <div className="mr-6">
//         <Line options={chartOptions} data={chartData} />
//       </div>
//     </LayoutBox>
//   );
// };

const Analytics = ({ collateral }) => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Overview</title>
      </Head>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <APYChartContainer />
        </div>
        <div className="col-span-12">
          <TotalSupplyChartContainer />
        </div>
        <div className="col-span-12 2xl:col-span-6">
          <OUSDMarketshareContainer />
        </div>
        <div className="col-span-12 2xl:col-span-6">
          <CurrentCollateralContainer data={collateral} />
        </div>
        {/*<div className="col-span-12">*/}
        {/*  <CurrentStrategiesChart />*/}
        {/*</div>*/}
        {/*<div className="col-span-12">*/}
        {/*  <OUSDChart />*/}
        {/*</div>*/}
      </div>
    </ErrorBoundary>
  );
};

export const getServerSideProps: GetServerSideProps = async (): Promise<{
  props;
}> => {
  const [allocation, { collateral }] = await Promise.all([
    fetchAllocation(),
    fetchCollateral(),
  ]);
  return {
    props: {
      collateral: orderBy(
        aggregateCollateral({ collateral, allocation }),
        'total',
        'desc'
      ),
    },
  };
};

export default Analytics;

Analytics.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
