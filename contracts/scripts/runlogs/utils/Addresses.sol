// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library CrossChain {
  // Governance
  address public constant STRATEGIST = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
}

library Mainnet {
  uint256 public constant CHAIN_ID = 1; // Mainnet chain ID
  // OUSD
  address public constant OUSD = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;

  // OETH
  address public constant OETH = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
  address public constant WOETH = 0xDcEe70654261AF21C44c093C300eD3Bb97b78192;
  address public constant OETH_VAULT = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;
  address public constant OETH_VAULT_VALUE_CHECKER = 0x31FD8618379D8e473Ec2B1540B906E8e11D2A99b;

  // OETH Strategies
  address public constant OETH_WETH_CURVE_AMO = 0xba0e352AB5c13861C26e4E773e7a833C3A223FE6;

  // Other token
  address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  // Curve pools
  address public constant OETH_WETH_CURVE_POOL = 0xcc7d5785AD5755B6164e21495E07aDb0Ff11C2A8;
}

library Base {
  uint256 public constant CHAIN_ID = 5483; // Base chain ID

  // OETHb
  address public constant OETHB = 0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3;
  address public constant WOETHB = 0x7FcD174E80f264448ebeE8c88a7C4476AAF58Ea6;
  address public constant OETHB_VAULT = 0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93;
  address public constant OETHB_VAULT_VALUE_CHECKER = 0x9D98Cf85B65Fa1ACef5e9AAA2300753aDF7bcf6A;

  // OETHb Strategies
  address public constant OETHB_WETH_CURVE_AMO = 0x9cfcAF81600155e01c63e4D2993A8A81A8205829;
  address public constant OETHB_WETH_AERODROME_POOL = 0xF611cC500eEE7E4e4763A05FE623E2363c86d2Af;

  // Other token
  address public constant WETH = 0x4200000000000000000000000000000000000006;

  // Curve pools
  address public constant OETHB_WETH_CURVE_POOL = 0x302A94E3C28c290EAF2a4605FC52e11Eb915f378;
}
