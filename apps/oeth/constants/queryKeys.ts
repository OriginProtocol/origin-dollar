const QUERY_KEYS = {
  ApyHistory: (days) => ["apyHistory", days],
  CirculatingSupply: () => ["circulatingSupply"],
  Price: () => ["price"],
  TotalSupply: () => ["totalSupply"],
};

export default QUERY_KEYS;
