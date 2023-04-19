import moment from "moment";
import { ChartOptions } from "chart.js";
import { commify } from "ethers/lib/utils";
import { mdSize } from "../../constants";

const barOptions: (e?: Partial<ChartOptions<"bar">>) => ChartOptions<"bar"> = (
  extraOptions
) => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: () => {
      let padding = 24;
      if (window.innerWidth < mdSize) padding = 12;
      return {
        left: padding,
        right: padding,
        bottom: padding,
      };
    },
  },
  plugins: {
    tooltip: {
      enabled: false,
      callbacks: {
        title: (context) =>
          moment(parseInt(context[0].label)).format("MMM DD YYYY"),
        label: (context) =>
          "$" + commify((context.raw as number).toFixed(2)).toString(),
      },
      external: () => {},
    },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      display: false,
    },
  },
  ...extraOptions,
});

export default barOptions;
