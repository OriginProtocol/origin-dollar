import { useQuery } from "react-query";
import { useMemo, useState } from "react";
import { isMobile } from "react-device-detect";
import { borderFormatting, filterByDuration, formatDisplay } from "../utils";

export const useProtocolRevenueChart = () => {
  const { data, isFetching } = useQuery(
    `/api/analytics/charts/protocolRevenue`,
    {
      initialData: {
        labels: [],
        datasets: [],
        error: null,
      },
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    }
  );

  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const baseData = useMemo(() => {
    if (data?.error) {
      return null;
    }
    return {
      labels: data?.labels,
      datasets: data?.datasets?.reduce((acc, dataset) => {
        if (!chartState?.typeOf || dataset.id === chartState?.typeOf) {
          acc.push({
            ...dataset,
            ...borderFormatting,
          });
        }
        return acc;
      }, []),
    };
  }, [JSON.stringify(data)]);

  const chartData = useMemo(() => {
    return baseData
      ? formatDisplay(filterByDuration(baseData, chartState?.duration))
      : null;
  }, [JSON.stringify(baseData), chartState?.duration, chartState?.typeOf]);

  const onChangeFilter = (value) => {
    setChartState((prev) => ({
      ...prev,
      ...value,
    }));
  };

  return [
    {
      data: chartData,
      // @ts-ignore
      aggregations: data?.aggregations || {},
      filter: chartState,
      isFetching,
      chartOptions: {
        responsive: true,
        aspectRatio: isMobile ? 1 : 3,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: false,
            position: "bottom",
          },
          tooltip: {
            enabled: true,
          },
        },
        interaction: {
          mode: "nearest",
          intersect: false,
          axis: "x",
        },
        scales: {
          x: {
            border: {
              color: "#4d505e",
              width: 0.5,
            },
            grid: {
              display: false,
            },
            ticks: {
              color: "#828699",
              autoSkip: false,
              maxRotation: 90,
              minRotation: 0,
              padding: 20,
              callback: function (val, index) {
                return (
                  isMobile ? (index + 22) % 28 === 0 : (index + 8) % 14 === 0
                )
                  ? this.getLabelForValue(val)
                  : null;
              },
            },
          },
          y: {
            border: {
              display: false,
              dash: [2, 4],
              dashOffset: 1,
            },
            grid: {
              color: "#4d505e",
              lineWidth: 0.5,
            },
            beginAtZero: true,
            position: "right",
            ticks: {
              color: "#828699",
              callback: function (val) {
                return val === 0 ? null : this.getLabelForValue(val);
              },
            },
          },
        },
      },
    },
    { onChangeFilter },
  ];
};
