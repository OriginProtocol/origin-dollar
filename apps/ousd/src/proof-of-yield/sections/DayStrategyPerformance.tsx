import React from "react";
import Image from "next/image";
import { Typography } from "@originprotocol/origin-storybook";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import { assetRootPath } from "../../utils/image";
import {
  Table,
  TableData,
  TableHead,
  ChartDetailsButton,
  PastWeekApyChart,
} from "../components";
import { commify } from "ethers/lib/utils";
import { useViewWidth } from "../../hooks";
import { lgSize } from "../../constants";

interface StrategyData {
  name: string;
  protocol: string;
  img: string;
  allocationAbs: number;
  allocationPct: number;
  weekApyData: number[][];
  apy: number;
  yieldAbs: number;
  yieldPct: number;
}

let partialMockStratData: { name: string; protocol: string; img: string }[] = [
  {
    name: "Aave DAI",
    protocol: "Aave",
    img: "tokens/aave-dai",
  },
  {
    name: "Aave USDC",
    protocol: "Aave",
    img: "tokens/aave-usdc",
  },
  {
    name: "Aave USDT",
    protocol: "Aave",
    img: "tokens/aave-usdt",
  },
  {
    name: "Compound DAI",
    protocol: "Compound",
    img: "tokens/compound-dai",
  },
  {
    name: "Compound USDC",
    protocol: "Compound",
    img: "tokens/compound-usdc",
  },
  {
    name: "Compound USDT",
    protocol: "Compound",
    img: "tokens/compound-usdt",
  },
  {
    name: "DAI+USDC+USDT",
    protocol: "Convex",
    img: "tokens/convex-3pool",
  },
  {
    name: "LUSD+3Crv",
    protocol: "Convex",
    img: "tokens/convex-lusd",
  },
  {
    name: "OUSD+3Crv",
    protocol: "Convex",
    img: "tokens/convex-meta",
  },
  {
    name: "Compound DAI",
    protocol: "Morpho",
    img: "dai-logo",
  },
  {
    name: "Compound USDC",
    protocol: "Morpho",
    img: "usdc-logo",
  },
  {
    name: "Compound USDT",
    protocol: "Morpho",
    img: "usdt-logo",
  },
];

const mockStratData: StrategyData[] = partialMockStratData.map((e) => ({
  ...e,
  allocationAbs: 2375810.0,
  allocationPct: 4.84,
  weekApyData: [
    [1, 4],
    [2, 8],
    [3, 2],
    [4, 6],
    [5, 2],
    [6, 12],
    [7, 3],
  ],
  apy: 2.48,
  yieldAbs: 50.92,
  yieldPct: 32.0,
}));

const strategyChartColumnCssLeft = "pl-4 md:pl-6 lg:w-auto";
const strategyChartColumnCssRight =
  "pr-0 sm:pr-2 md:pr-6 w-fit lg:w-[1%] xl:pr-12 2xl:pr-20";

interface DayStrategyPerformanceProps {
  sectionOverrideCss?: string;
}

const DayStrategyPerformance = ({
  sectionOverrideCss,
}: DayStrategyPerformanceProps) => {
  const width = useViewWidth();

  return (
    <Section className={twMerge("mt-10 md:mt-14", sectionOverrideCss)}>
      <Typography.Body className="text-blurry mb-3">
        Strategy performance on this day (pre-dripper){" "}
      </Typography.Body>
      <Typography.Body3 className="text-sm text-table-title mb-6">
        Strategies and yield sources that were earning yield on the selected
        date or block.
      </Typography.Body3>
      <Table>
        <thead>
          <tr>
            <TableHead className={strategyChartColumnCssLeft} align="left">
              Strategy
            </TableHead>
            {width >= lgSize && (
              <TableHead className={strategyChartColumnCssRight}>
                Allocation
              </TableHead>
            )}
            {width >= lgSize && (
              <TableHead className={strategyChartColumnCssRight}>
                Last 7 days APY
              </TableHead>
            )}
            <TableHead
              info={true}
              className={twMerge(strategyChartColumnCssRight, "pr-2")}
            >
              APY
            </TableHead>
            <TableHead
              className={twMerge("py-3", strategyChartColumnCssRight, "pr-4")}
            >
              Yield / <br /> % of total
            </TableHead>
            {/* <TableHead className={strategyChartColumnCssRight}>
              {width >= lgSize && "More details"}
            </TableHead> */}
          </tr>
        </thead>
        <tbody>
          {mockStratData.map((e, i) => (
            <tr
              className="group border-t md:border-t-2 hover:bg-hover-bg border-origin-bg-black"
              key={`${e.name}-${e.protocol}`}
            >
              <TableData
                align="left"
                className={twMerge(
                  strategyChartColumnCssLeft,
                  `${i + 1 == mockStratData.length ? "rounded-bl-lg" : ""}`,
                  "flex"
                )}
              >
                <Image
                  src={assetRootPath(`/images/${e.img}.svg`)}
                  width="40"
                  height="40"
                  alt={e.img}
                  className="mr-3 hidden sm:inline"
                />
                <div>
                  <Typography.Body className="text-xs text-table-data">
                    {e.name}
                  </Typography.Body>
                  <Typography.Body2 className="text-[11px] md:text-sm text-table-title">
                    {e.protocol}
                  </Typography.Body2>
                </div>
              </TableData>
              {width >= lgSize && (
                <TableData className={strategyChartColumnCssRight}>
                  <Typography.Body className="text-table-data">
                    ${commify(e.allocationAbs)}
                  </Typography.Body>
                  <Typography.Body3 className="text-sm text-table-title">
                    {e.allocationPct}%
                  </Typography.Body3>
                </TableData>
              )}
              {width >= lgSize && (
                <TableData className={strategyChartColumnCssRight}>
                  <PastWeekApyChart data={e.weekApyData} />
                </TableData>
              )}
              <TableData
                className={twMerge(strategyChartColumnCssRight, "pr-2")}
              >
                <Typography.Body className="text-xs text-table-data">
                  {e.apy}%
                </Typography.Body>
              </TableData>
              <TableData
                className={twMerge(
                  strategyChartColumnCssRight,
                  `pr-4 ${i + 1 == mockStratData.length ? "rounded-br-lg" : ""}`
                )}
              >
                <Typography.Body className="text-xs text-table-data">
                  ${commify(e.yieldAbs)}
                </Typography.Body>
                <Typography.Body3 className="text-[11px] md:text-sm text-table-title">
                  {e.yieldPct}%
                </Typography.Body3>{" "}
              </TableData>
              {/* <TableData className={strategyChartColumnCssRight}>
                <ChartDetailsButton onClick={() => {}}>
                  Details
                </ChartDetailsButton>
              </TableData> */}
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
};

export default DayStrategyPerformance;
