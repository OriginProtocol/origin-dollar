import { ChartData } from "chart.js";

const doughnutData: ChartData<"doughnut"> = {
  labels: [
    "Airdrop to OGN holders",
    "Future liquidity mining",
    "DAO reserve",
    "Airdrop to OUSD holders",
    "Early contributors",
    "Future contributors",
    "Prelaunch liquidity mining campaign",
  ],
  datasets: [
    {
      label: "4000000000",
      data: [
        1000000000, 1000000000, 750000000, 400000000, 400000000, 400000000,
        50000000,
      ],
      backgroundColor: [
        "#6222FD",
        "#5BC0EB",
        "#EF767A",
        "#66FE90",
        "#FFDC86",
        "#54414E",
        "#FF57F2",
      ],
      borderWidth: 0,
    },
  ],
};

export default doughnutData;
