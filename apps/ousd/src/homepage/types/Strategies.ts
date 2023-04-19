interface Strategy {
  total: number;
  name: string;
  icon_file: string;
  holdings: {
    DAI: number;
    USDC: number;
    USDT: number;
  };
  address: string;
}

interface Strategies {
  aavestrat_holding: Strategy;
  compstrat_holding: Strategy;
  lusd_metastrat: Strategy;
  morpho_aave_strat: Strategy;
  morpho_strat: Strategy;
  ousd_metastrat: Strategy;
  threepoolstrat_holding: Strategy;
  vault_holding: Strategy;
}

export default Strategies;
