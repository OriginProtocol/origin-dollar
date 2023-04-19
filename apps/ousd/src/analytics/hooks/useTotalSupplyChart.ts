import { useQuery } from "react-query";
import { useMemo, useState } from "react";
import {
  borderFormatting,
  createGradient,
  filterByDuration,
  formatDisplay,
} from "../utils";

export const useTotalSupplyChart = () => {
  const { data, isFetching } = useQuery("/api/analytics/charts/totalSupply", {
    initialData: {
      labels: [],
      datasets: [],
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const chartData = useMemo(() => {
    return formatDisplay(
      filterByDuration(
        {
          labels: data?.labels,
          datasets: data?.datasets?.reduce((acc, dataset) => {
            if (!chartState?.typeOf || dataset.id === chartState?.typeOf) {
              acc.push({
                ...dataset,
                ...borderFormatting,
                borderWidth: 0,
                backgroundColor: createGradient(["#8C66FC", "#0274F1"]),
                fill: true,
              });
            }
            return acc;
          }, []),
        },
        chartState.duration
      )
    );
  }, [JSON.stringify(data), chartState?.duration, chartState?.typeOf]);

  const onChangeFilter = (value) => {
    setChartState((prev) => ({
      ...prev,
      ...value,
    }));
  };

  return [
    {
      data: chartData,
      filter: chartState,
      isFetching,
    },
    { onChangeFilter },
  ];
};
