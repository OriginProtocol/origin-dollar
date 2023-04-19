import { useQuery } from "react-query";
import { useMemo, useState } from "react";
import {
  borderFormatting,
  createGradient,
  filterByDuration,
  formatDisplay,
} from "../utils";

export const useMarketshareChart = () => {
  const { data, isFetching } = useQuery(
    "/api/analytics/charts/ousdMarketshare",
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
  });

  const chartData = useMemo(() => {
    if (data?.error) {
      return null;
    }
    return formatDisplay(
      filterByDuration(
        {
          labels: data?.labels,
          datasets: data?.datasets?.map((dataset) => ({
            ...dataset,
            ...borderFormatting,
            borderColor: createGradient(["#8C66FC", "#0274F1"]),
          })),
        },
        chartState.duration
      )
    );
  }, [JSON.stringify(data), chartState?.duration]);

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
