// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library Mainnet {
  // Governance
  address public constant MULTICHAIN_STRATEGIST = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;
  
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
