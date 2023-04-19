import { reduce } from "lodash";

export const toChartData = (rows, keys) => {
  const initialState = reduce(
    keys,
    (acc, toKey) => {
      acc[toKey] = [];
      return acc;
    },
    {}
  );
  return rows?.reduce((acc, row) => {
    Object.keys(keys).forEach((fromKey) => {
      const toKey = keys[fromKey];
      acc[toKey]?.push(row[fromKey]);
    });
    return acc;
  }, initialState);
};

export const formatLabels = (labels) =>
  labels.map((d) => new Date(d).toString().slice(4, 10));
