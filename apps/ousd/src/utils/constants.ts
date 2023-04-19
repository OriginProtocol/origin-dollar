import { createTheme } from "@mui/material/styles";

export const apyDayOptions = [7, 30, 365];
export const DEFAULT_SELECTED_APY = 30;

export const theme = createTheme({
  palette: {
    // @ts-ignore
    Compound: {
      main: "#00d592",
    },
    Aave: {
      main: "#7a26f3",
    },
    Convex: {
      main: "#ff5a5a",
    },
    Morpho: {
      main: "#9bc3e9",
    },
  },
});

export const protocolMapping = {
  Convex: {
    image: "/images/convex-strategy.svg",
    description:
      "Convex allows liquidity providers and stakers to earn greater rewards from Curve, a stablecoin-centric automated market maker (AMM). OUSD earns trading fees and protocol token incentives (both CRV and CVX). This strategy employs base pools and metapools, including the Origin Dollar factory pool, which enables OUSD to safely leverage its own deposits to multiply returns and maintain the pool’s balance.",
  },
  Morpho: {
    image: "/images/morpho-strategy.svg",
    description:
      "Morpho adds a peer-to-peer layer on top of Compound and Aave allowing lenders and borrowers to be matched more efficiently with better interest rates. When no matching opportunity exists, funds flow directly through to the underlying protocol. OUSD supplies stablecoins to three of Morpho’s Compound markets to earn interest. Additional yield is generated from protocol token incentives, including both COMP (regularly sold for USDT) and MORPHO (currently locked).",
  },
  Aave: {
    image: "/images/aave-strategy.svg",
    description:
      "Aave is a liquidity protocol where users can participate as suppliers or borrowers. Each loan is over-collateralized to ensure repayment. OUSD deploys stablecoins to three of the Aave V2 markets and earns interest approximately every 12 seconds. Additional yield is generated from protocol token incentives (AAVE), which are regularly sold for USDT on Uniswap and compounded.",
  },
  Compound: {
    image: "/images/compound-strategy.svg",
    description:
      "Compound is an interest rate protocol allowing lenders to earn yield on digital assets by supplying them to borrowers. Each loan is over-collateralized to ensure repayment. OUSD deploys stablecoins to three of the Compound V2 markets and earns interest approximately every 12 seconds. Additional yield is generated from protocol token incentives (COMP), which are regularly sold for USDT on Uniswap and compounded.",
  },
};

export const strategyMapping = {
  vault_holding: {
    protocol: "Vault",
    name: "Origin Vault",
    address: "0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70",
    dai: "0x6b175474e89094c44da98b954eedeac495271d0f",
    usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    usdt: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  },
  threepoolstrat_holding: {
    protocol: "Convex",
    name: "Convex DAI+USDC+USDT",
    address: "0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3",
    icon: "/images/tokens/convex-3pool.svg",
  },
  ousd_metastrat: {
    protocol: "Convex",
    name: "Convex OUSD+3Crv",
    address: "0x7a192dd9cc4ea9bdedec9992df74f1da55e60a19",
    icon: "/images/tokens/convex-meta.svg",
  },
  lusd_metastrat: {
    protocol: "Convex",
    name: "Convex LUSD+3Crv",
    address: "0x7a192dd9cc4ea9bdedec9992df74f1da55e60a19",
    icon: "/images/tokens/convex-lusd.svg",
  },
  morpho_strat: {
    protocol: "Morpho",
    singleAsset: true,
    name: "Morpho Compound",
    address: "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D",
  },
  morpho_aave_strat: {
    protocol: "Morpho",
    singleAsset: true,
    name: "Morpho Aave",
    address: "0x79f2188ef9350a1dc11a062cca0abe90684b0197",
  },
  aavestrat_holding: {
    protocol: "Aave",
    singleAsset: true,
    name: "Aave",
    address: "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
    dai: "0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d",
    usdc: "0xe87ba1bd11ee6e0d3c7dd6932e6a038e38627f65",
    usdt: "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8",
  },
  compstrat_holding: {
    protocol: "Compound",
    singleAsset: true,
    name: "Compound",
    address: "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
    dai: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
    usdc: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
    usdt: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  },
};

export const tokenColors = {
  usdc: "#2775ca",
  dai: "#f4b731",
  usdt: "#26a17b",
  ousd: "#000000",
};

export const sanitizationOptions = {
  allowedTags: [
    "b",
    "i",
    "em",
    "strong",
    "u",
    "a",
    "img",
    "h1",
    "h2",
    "h3",
    "span",
    "p",
    "ul",
    "ol",
    "li",
    "br",
    "figure",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "srcset", "sizes"],
    span: ["style"],
    ul: ["style"],
    ol: ["style"],
  },
  allowedIframeHostnames: ["www.youtube.com"],
};
