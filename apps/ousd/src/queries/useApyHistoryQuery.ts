import { useQuery } from "react-query";

import { QUERY_KEYS } from "../constants/queryKeys";

import { apyHistoryService } from "../services/apy-history.service";

const useApyHistoryQuery = (apyHistory, options = {}) => {
  return useQuery(
    QUERY_KEYS.ApyHistory(365),
    () => apyHistoryService.fetchApyHistory(),
    {
      initialData: apyHistory,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
      ...options,
    }
  );
};

export default useApyHistoryQuery;
