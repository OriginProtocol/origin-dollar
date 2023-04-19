import React from "react";
import { Section } from "../../components";
import { TableData, TableHead, Table, ChartDetailsButton } from "../components";
import { smSize } from "../../constants";
import { useViewWidth } from "../../hooks";
import { useRouter } from "next/router";
import { utils } from "ethers";
const { commify } = utils;

interface DailyYieldProps {}

const ex = {
  date: 1675886432000,
  yieldDistributed: 1873.92,
  apy: 3.08,
  vaultValue: 49063918,
};

const mockData = [];

for (let i = 0; i < 20; i++) {
  mockData.push(Object.assign({ ...ex }, { date: ex.date + i * 86400000 }));
}

const DailyYield = ({}: DailyYieldProps) => {
  const width = useViewWidth();
  const router = useRouter();

  const routeToYieldOnDay = (date: number) => {
    router.push(`/proof-of-yield/${date}`);
  };
  return (
    <Section className="mt-10 md:mt-28">
      {/* Buttons */}
      {/* <div className="mb-3 sm:mb-6 bg-tooltip w-fit p-2 rounded-[100px]">
        <button
          className={twMerge(
            `rounded-[100px] border border-tooltip px-12 py-3`,
            ` ${days ? highlightCss : ""}`
          )}
          onClick={() => seTableDataays(true)}
        >
          Days
        </button>
        <button
          className={twMerge(
            `rounded-[100px] border border-tooltip px-12 py-3`,
            ` ${!days ? highlightCss : ""}`
          )}
          onClick={() => seTableDataays(false)}
        >
          Blocks
        </button>
      </div> */}

      {/* Main Table */}
      <Table>
        {/* Table Head */}

        <thead>
          <tr>
            <TableHead align="left" className="pl-8">
              Date
            </TableHead>
            <TableHead
              info={true}
              className="whitespace-normal sm:whitespace-nowrap pr-8 lg:pr-14 xl:pr-24"
            >
              Yield distributed
            </TableHead>
            <TableHead info={true} className="pr-0 sm:pr-8 lg:pr-14 xl:pr-24">
              APY
            </TableHead>
            {width >= smSize && (
              <TableHead info={true} className="pr-0 xl:pr-8">
                Vault value
              </TableHead>
            )}
            <TableHead></TableHead>
          </tr>
        </thead>

        {/* Table Body */}

        <tbody className="relative px-6">
          {mockData.map((item, i) => (
            <tr
              className="group border-t md:border-t-2 hover:bg-hover-bg border-origin-bg-black cursor-pointer"
              key={item.date}
              onClick={() => routeToYieldOnDay(item.date)}
            >
              <TableData align="left" className="pl-8">
                {new Date(item.date).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                  day: "numeric",
                })}
              </TableData>
              <TableData className="pr-8 lg:pr-14 xl:pr-24">
                ${commify(item.yieldDistributed)}
              </TableData>
              <TableData className="pr-0 sm:pr-8 lg:pr-14 xl:pr-24">
                {item.apy}%
              </TableData>
              {width >= smSize && (
                <TableData className="pr-0 xl:pr-8">
                  ${commify(item.vaultValue)}
                </TableData>
              )}
              <TableData className="px-6" align="center">
                <ChartDetailsButton
                  onClick={() => routeToYieldOnDay(item.date)}
                >
                  Proof of yield
                </ChartDetailsButton>
              </TableData>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
};

export default DailyYield;
