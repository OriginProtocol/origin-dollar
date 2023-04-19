import { Typography } from "@originprotocol/origin-storybook";

const DefaultChartHeader = ({ title, display, date }) => {
  return (
    <div className="flex flex-col w-full h-full">
      <Typography.Caption className="text-subheading">
        {title}
      </Typography.Caption>
      <Typography.H4>{display}</Typography.H4>
      <Typography.Caption className="text-subheading">
        {date}
      </Typography.Caption>
    </div>
  );
};

export default DefaultChartHeader;
