import { ChartOptions } from "chart.js";

const lineOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  events: [],
  scales: {
    x: {
      display: false,
    },
    y: {
      display: false,
    },
  },
};

export default lineOptions;
