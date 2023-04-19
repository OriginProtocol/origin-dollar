import { ChartOptions } from "chart.js";

const doughnutOptions: ChartOptions<"doughnut"> = {
  maintainAspectRatio: false,
  cutout: "80%",
  plugins: {
    tooltip: {
      enabled: false,
    },
    //@ts-ignore
    distributionLegend: {
      containerId: "legend-container",
    },
  },
};

export default doughnutOptions;
