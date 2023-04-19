import React, { useMemo, useState } from "react";
import { useQuery } from "react-query";
import Head from "next/head";
import Link from "next/link";
import { Typography } from "@originprotocol/origin-storybook";
import { GetServerSideProps } from "next";
import classnames from "classnames";
import { last, map } from "lodash";
import { Bar } from "react-chartjs-2";
import { orderBy } from "lodash";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
} from "chart.js";
import {
  ErrorBoundary,
  LayoutBox,
  Image,
  TwoColumnLayout,
} from "../../src/components";
import { DurationFilter } from "../../src/analytics/components";
import {
  aggregateCollateral,
  backingTokens,
  createGradient,
} from "../../src/analytics/utils";
import { fetchAllocation } from "../../lib/allocation";
import { fetchCollateral } from "../../lib/collateral";
import {
  formatCurrency,
  formatCurrencyAbbreviated,
} from "../../src/utils/math";

ChartJS.register(CategoryScale, LinearScale, BarElement);

const CollateralAggregate = ({ data = [] }) => {
  return (
    <div className="flex flex-col md:flex-row gap-1 items-center w-full">
      {data.map(({ label, logoSrc, percentage, total }, index) => (
        <LayoutBox
          key={label}
          className={classnames({
            "rounded-tr-none rounded-br-none w-full h-full": index === 0,
            "rounded-none": index > 0 && index !== data.length - 1, // middle sections
            "rounded-tl-none rounded-bl-none": index === data.length - 1,
          })}
        >
          <div className="flex flex-row w-full h-[110px] md:h-[150px] items-center space-x-6 px-6">
            <Image src={logoSrc} width={48} height={48} alt={label} />
            <div className="flex flex-col space-y-1">
              <Typography.Caption className="text-subheading">
                {label}
              </Typography.Caption>
              <Typography.Body>${formatCurrency(total, 2)}</Typography.Body>
              <Typography.Caption className="text-subheading">
                {formatCurrency(percentage * 100, 2)}%
              </Typography.Caption>
            </div>
          </div>
        </LayoutBox>
      ))}
    </div>
  );
};

const CollateralChart = () => {
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
      <div className="flex flex-row justify-between w-full h-[210px] p-4 md:p-6">
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
      <div className="mr-6">
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

const CollateralPoolDistributions = ({ data = [] }) => {
  return (
    <div className="flex flex-col space-y-6">
      <Typography.Body3>Collateral Distribution</Typography.Body3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {data?.map(
          ({ name, address, icon_file: iconFilename, total, holdings }) => (
            <LayoutBox key={name}>
              <div className="flex flex-col w-full h-full p-6">
                <Typography.Body3>{name}</Typography.Body3>
                <Typography.Caption2 className="text-subheading">
                  Collateral
                </Typography.Caption2>
                <div className="flex flex-wrap w-full h-full gap-4 py-4">
                  {map(holdings, (holdingTotal, token) =>
                    backingTokens[token] ? (
                      <div
                        key={token}
                        className="flex flex-row space-x-3 items-center w-[120px]"
                      >
                        <Image
                          src={backingTokens[token]?.logoSrc}
                          width={28}
                          height={28}
                          alt={token}
                        />
                        <div className="flex flex-col">
                          <Typography.Caption>{token}</Typography.Caption>
                          <Link
                            href={`https://etherscan.io/address/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-row space-x-1 items-center"
                          >
                            <Typography.Caption className="text-subheading">
                              ${formatCurrencyAbbreviated(holdingTotal, 2)}
                            </Typography.Caption>
                            <Image
                              src="/images/link.svg"
                              width="12"
                              height="12"
                              alt="External link"
                            />
                          </Link>
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </LayoutBox>
          )
        )}
      </div>
    </div>
  );
};

const AnalyticsCollateral = ({ strategies, collateral }) => {
  return (
    <ErrorBoundary>
      <Head>
        <title>Analytics | Collateral</title>
      </Head>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <CollateralAggregate data={collateral} />
        </div>
        {/*<div className="col-span-12">*/}
        {/*  <CollateralChart />*/}
        {/*</div>*/}
        <div className="col-span-12">
          <CollateralPoolDistributions data={strategies} />
        </div>
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
      strategies: orderBy(allocation?.strategies, "total", "desc"),
      collateral: orderBy(
        aggregateCollateral({ collateral, allocation }),
        "total",
        "desc"
      ),
    },
  };
};

export default AnalyticsCollateral;

AnalyticsCollateral.getLayout = (page, props) => (
  <TwoColumnLayout {...props}>{page}</TwoColumnLayout>
);
