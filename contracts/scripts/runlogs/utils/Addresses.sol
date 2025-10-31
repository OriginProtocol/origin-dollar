// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library CrossChain {
  // Governance
  address public constant STRATEGIST = 0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971;

  // Protocols
  address public constant MORPHO_BLUE = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;
}

library Mainnet {
  uint256 public constant CHAIN_ID = 1; // Mainnet chain ID

  // Governance
  address public constant TIMELOCK = 0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F;
  address public constant TREASURY = 0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc;

  // OUSD
  address public constant OUSD = 0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86;

  // OETH
  address public constant OETH = 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3;
  address public constant WOETH = 0xDcEe70654261AF21C44c093C300eD3Bb97b78192;
  address public constant OETH_VAULT = 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab;
  address public constant OETH_VAULT_VALUE_CHECKER = 0x31FD8618379D8e473Ec2B1540B906E8e11D2A99b;

  // OETH Strategies
  address public constant OETH_WETH_CURVE_AMO = 0xba0e352AB5c13861C26e4E773e7a833C3A223FE6;

  // Pool Booster
  address public constant POOL_BOOSTER_FACTORY_MERKL = 0x0FC66355B681503eFeE7741BD848080d809FD6db;
  address public constant POOL_BOOSTER_CENTRAL_REGISTRY =
    0xAA8af8Db4B6a827B51786334d26349eb03569731;

  // Other token
  address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  // Curve pools
  address public constant OETH_WETH_CURVE_POOL = 0xcc7d5785AD5755B6164e21495E07aDb0Ff11C2A8;

  // ARMs
  address public constant ETHERFI_ARM = 0xfB0A3CF9B019BFd8827443d131b235B3E0FC58d2;
}

library Base {
  uint256 public constant CHAIN_ID = 5483; // Base chain ID

  // Governance
  address public constant TIMELOCK = 0xf817cb3092179083c48c014688D98B72fB61464f;

  // OETHb
  address public constant OETHB = 0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3;
  address public constant WOETHB = 0x7FcD174E80f264448ebeE8c88a7C4476AAF58Ea6;
  address public constant OETHB_VAULT = 0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93;
  address public constant OETHB_VAULT_VALUE_CHECKER = 0x9D98Cf85B65Fa1ACef5e9AAA2300753aDF7bcf6A;

  // OETHb Strategies
  address public constant OETHB_WETH_CURVE_AMO = 0x9cfcAF81600155e01c63e4D2993A8A81A8205829;
  address public constant OETHB_WETH_AERODROME_POOL = 0xF611cC500eEE7E4e4763A05FE623E2363c86d2Af;

  // Pool Booster
  address public constant POOL_BOOSTER_FACTORY_MERKL = 0x1ADB902Ece465cA681C66187627a622a631a0a63;
  address public constant POOL_BOOSTER_CENTRAL_REGISTRY =
    0x157f0B239D7F83D153E6c95F8AD9d341694376E3;

  // Other token
  address public constant WETH = 0x4200000000000000000000000000000000000006;

  // Curve pools
  address public constant OETHB_WETH_CURVE_POOL = 0x302A94E3C28c290EAF2a4605FC52e11Eb915f378;
}

library Sonic {
  uint256 public constant CHAIN_ID = 146; // Sonic chain ID

  // Governance
  address public constant GOVERNOR = 0xAdDEA7933Db7d83855786EB43a238111C69B00b6;
  address public constant TIMELOCK = 0x31a91336414d3B955E494E7d485a6B06b55FC8fB;
  address public constant STRATEGIST = 0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a;

  // OS
  address public constant OS = 0xb1e25689D55734FD3ffFc939c4C3Eb52DFf8A794;
  address public constant OS_VAULT = 0xa3c0eCA00D2B76b4d1F170b0AB3FdeA16C180186;
  address public constant OS_VAULT_VALUE_CHECKER = 0x06f172e6852085eCa886B7f9fd8f7B21Db3D2c40;

  // ARM
  address public constant ARM = 0x2F872623d1E1Af5835b08b0E49aAd2d81d649D30;

  // Strategies
  address public constant STAKING_STRATEGY = 0x596B0401479f6DfE1cAF8c12838311FeE742B95c;

  // Other token
  address public constant WS = 0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38;
}
