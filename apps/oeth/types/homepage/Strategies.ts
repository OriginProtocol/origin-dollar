interface Strategy {
  total: number;
  name: string;
  icon_file: string;
  holdings: {
    ETH?: number;
    stETH?: number;
    rETH?: number;
    sfrxETH?: number;
  };
  address: string;
}

interface Strategies {
  vault_holding: Strategy;
  lidostrat_holding: Strategy;
  convexstrat_holding: Strategy;
  fraxstrat_holding: Strategy;
  [key: string]: Strategy;
}

export default Strategies;
