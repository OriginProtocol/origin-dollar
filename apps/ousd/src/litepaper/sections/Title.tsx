import React from "react";
import moment from "moment";
import { Typography } from "@originprotocol/origin-storybook";
import { Section } from "../../components";

interface TitleProps {
  lastUpdated: number;
}

const Title = ({ lastUpdated }: TitleProps) => {
  return (
    <Section innerDivClassName="flex items-center flex-col">
      <Typography.H4 className="w-full lg:w-[763px] mb-6">
        OUSD/OGV litepaper
      </Typography.H4>
      <Typography.Body2 className="w-full lg:w-[763px] text-table-title">
        Last updated {moment(lastUpdated).format("MMMM DD, YYYY")}
      </Typography.Body2>
    </Section>
  );
};

export default Title;
