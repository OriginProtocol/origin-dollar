import { Typography } from "@originprotocol/origin-storybook";
import React from "react";
import { twMerge } from "tailwind-merge";
import { Section } from "../../components";
import {
  ChartDetailsButton,
  Table,
  TableData,
  TableHead,
  TitleWithInfo,
} from "../components";

const mockData = [
  {
    source: "Strategy reallocations",
    yieldAbs: 22,
    yieldPct: 32,
  },
  {
    source: "Redemption fees",
    yieldAbs: 36,
    yieldPct: 32,
  },
];

interface DayOtherSourcesProps {
  sectionOverrideCss?: string;
}

const DayOtherSources = ({ sectionOverrideCss }: DayOtherSourcesProps) => {
  return (
    <Section className={twMerge("", sectionOverrideCss)}>
      <Table className="mt-8">
        <thead>
          <tr>
            <TableHead align="left" className="pl-4 md:pl-8 w-auto">
              Other Sources
            </TableHead>
            <TableHead info={true} className="pr-6 md:pr-24 whitespace-normal">
              Yield / <br />{" "}
              <span className="whitespace-nowrap">% of total</span>
            </TableHead>
            <TableHead className="pr-4 md:pr-8 whitespace-normal">
              More details
            </TableHead>
          </tr>
        </thead>

        <tbody>
          {mockData.map((item) => (
            <tr key={item.source} className="border-t-2 border-origin-bg-black">
              <TableData align="left" className="pl-4 md:pl-8 w-auto">
                {item.source}
              </TableData>
              <TableData className="pr-6 md:pr-24">
                <Typography.Body>${item.yieldAbs}</Typography.Body>
                <Typography.Body2 className="text-sm text-table-title">
                  {item.yieldPct}%
                </Typography.Body2>
              </TableData>
              <TableData className="pr-4 md:pr-8">
                <ChartDetailsButton onClick={() => {}}>
                  Details
                </ChartDetailsButton>
              </TableData>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
};

export default DayOtherSources;
