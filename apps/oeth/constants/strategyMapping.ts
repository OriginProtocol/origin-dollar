const strategyMapping: {
  [key: string]: {
    protocol: string;
    name: string;
    address: string;
    vault?: boolean;
    icon?: string;
    icons?: { [key: string]: string };
  };
} = {
  vault_holding: {
    protocol: "Vault",
    name: "Origin Vault",
    address: "0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70",
    vault: true,
    icons: {
      ETH: "/images/eth.svg",
      stETH: "/images/steth.svg",
      rETH: "/images/reth.svg",
      sfrxETH: "/images/sfrxeth.svg",
    },
  },
  lidostrat_holding: {
    protocol: "Lido",
    name: "Lido staked Ether (stETH)",
    address: "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
    icon: "/images/lido-strategy.svg",
  },
  convexstrat_holding: {
    protocol: "Convex",
    name: "Convex ETH + Rocket Pool Ether (rETH)",
    address: "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
    icon: "/images/convex-strategy.svg",
  },
  fraxstrat_holding: {
    protocol: "Frax",
    name: "Frax staked Ether (sfrxETH)",
    address: "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
    icon: "/images/frax-strategy.svg",
  },
};

export default strategyMapping;
