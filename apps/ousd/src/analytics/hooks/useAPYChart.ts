import { useQuery } from "react-query";
import { useMemo, useState } from "react";
import { borderFormatting, filterByDuration, formatDisplay } from "../utils";

export const useAPYChart = () => {
  const { data, isFetching } = useQuery(`/api/analytics/charts/apy`, {
    initialData: {
      labels: [],
      datasets: [],
      error: null,
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  const [chartState, setChartState] = useState({
    duration: "all",
    typeOf: "total",
  });

  const chartData = useMemo(() => {
    if (data?.error) {
      return null;
    }
    return formatDisplay(
      filterByDuration(
        {
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
        },
        chartState?.duration
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
