import { useMemo, useState } from "react";
import { formatCurrency, formatPercentage } from "../../utils/math";

const mockData = [
  {
    type: "rebasing",
    label: "OUSD swap",
    total: 14380104,
    totalDisplay: `$${formatCurrency(14380104, 0)}`,
    color: "#1A44B5",
  },
  {
    type: "rebasing",
    label: "Other",
    total: 14380104,
    totalDisplay: `$${formatCurrency(14380104, 0)}`,
    color: "#2A70F5",
  },
  {
    type: "nonRebasing",
    label: "Curve",
    total: 23705812,
    totalDisplay: `$${formatCurrency(23705812, 0)}`,
    color: "#4B3C6D",
  },
  {
    type: "nonRebasing",
    label: "Uniswap v3 OUSD/USDT",
    total: 16411187,
    totalDisplay: `$${formatCurrency(16411187, 0)}`,
    color: "#D72FC6",
  },
  {
    type: "nonRebasing",
    label: "Other",
    total: 16411187,
    totalDisplay: `$${formatCurrency(16411187, 0)}`,
    color: "#9951EF",
  },
];

export const useSupplyDistributionChart = () => {
  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const chartData = useMemo(() => {
    return {
      labels: mockData.map((item) => item.label),
      datasets: [
        {
          label: "Current total Supply breakdown",
          data: mockData.map((item) => item.total),
          backgroundColor: mockData.map((item) => item.color),
          borderWidth: 0,
          hoverOffset: 50,
        },
      ],
    };
  }, []);

  const onChangeFilter = (value) => {};

  return [
    {
      data: chartData,
      filter: chartState,
      detailed: mockData,
      isFetching: false,
      chartOptions: {
        responsive: true,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
          },
        },
        cutout: "70%",
      },
    },
    { onChangeFilter },
  ];
};
