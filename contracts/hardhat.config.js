const ethers = require("ethers");
const { task } = require("hardhat/config");
const {
  isArbitrumFork,
  isHoleskyFork,
  isHolesky,
  isForkTest,
  isHoleskyForkTest,
  isBase,
  isBaseFork,
  isBaseForkTest,
  isBaseUnitTest,
  isSonic,
  isSonicFork,
  isSonicForkTest,
  isSonicUnitTest,
  isBNB,
  isBNBFork,
  isBNBForkTest,
  isBNBUnitTest,
  baseProviderUrl,
  sonicProviderUrl,
  arbitrumProviderUrl,
  holeskyProviderUrl,
  bnbProviderUrl,
  adjustTheForkBlockNumber,
  getHardhatNetworkProperties,
} = require("./utils/hardhat-helpers.js");

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-tracer");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@openzeppelin/hardhat-upgrades");

require("./tasks/tasks");
const { accounts } = require("./tasks/account");

const addresses = require("./utils/addresses.js");
const MAINNET_DEPLOYER =
  process.env.MAINNET_DEPLOYER_OVERRIDE ||
  "0x3Ba227D87c2A7aB89EAaCEFbeD9bfa0D15Ad249A";
// Mainnet decentralized OGV Governor
const MAINNET_GOVERNOR_FIVE = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
// Mainnet decentralized OGV Timelock
const MAINNET_TIMELOCK = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
// Mainnet contracts are governed by the Governor contract (which derives off Timelock).
const MAINNET_GOVERNOR = "0x72426ba137dec62657306b12b1e869d43fec6ec7";
// Multi-sig that controls the Governor. Aka "Guardian".
const MAINNET_MULTISIG = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
const MAINNET_STRATEGIST = "0xf14bbdf064e3f67f51cd9bd646ae3716ad938fdc";
const HOLESKY_DEPLOYER = "0x1b94CA50D3Ad9f8368851F8526132272d1a5028C";

const BASE_DEPLOYER = MAINNET_DEPLOYER;
const BASE_TIMELOCK = addresses.base.timelock;
const BASE_GOVERNOR = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
const BASE_STRATEGIST = "0x28bce2eE5775B652D92bB7c2891A89F036619703";

const SONIC_DEPLOYER = MAINNET_DEPLOYER;
// TODO: update Sonic Governor and strategist
const SONIC_GOVERNOR = MAINNET_DEPLOYER;
const SONIC_STRATEGIST = MAINNET_DEPLOYER;

// TODO: Update after deployment
const BNB_GOVERNOR = MAINNET_DEPLOYER;
const BNB_STRATEGIST = MAINNET_DEPLOYER;
const BNB_DEPLOYER = MAINNET_DEPLOYER;
const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});

let forkBlockNumber = adjustTheForkBlockNumber();

const paths = {};
if (isHolesky || isHoleskyForkTest || isHoleskyFork) {
  // holesky deployment files are in contracts/deploy/holesky
  paths.deploy = "deploy/holesky";
} else if (isBase || isBaseFork || isBaseForkTest || isBaseUnitTest) {
  paths.deploy = "deploy/base";
} else if (isSonic || isSonicFork || isSonicForkTest || isSonicUnitTest) {
  paths.deploy = "deploy/sonic";
} else if (isBNB || isBNBFork || isBNBForkTest || isBNBUnitTest) {
  paths.deploy = "deploy/bnb";
} else {
  // holesky deployment files are in contracts/deploy/mainnet
  paths.deploy = "deploy/mainnet";
}
if (process.env.HARDHAT_CACHE_DIR) {
  paths.cache = process.env.HARDHAT_CACHE_DIR;
}
const { provider, chainId } = getHardhatNetworkProperties();

const getDeployerAddressOrIndex = (fallbackAccountIndex = 0) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }

  if (isArbitrumFork) {
    return MAINNET_DEPLOYER;
  } else if (isBaseFork) {
    return BASE_DEPLOYER;
  } else if (isSonicFork) {
    return SONIC_DEPLOYER;
  } else if (isBNBFork) {
    return BNB_DEPLOYER;
  } else if (isHoleskyFork) {
    return HOLESKY_DEPLOYER;
  }

  return MAINNET_DEPLOYER;
}

const getGovernorAddressOrIndex = (fallbackAccountIndex = 1) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }

  if (isArbitrumFork) {
    return MAINNET_GOVERNOR;
  } else if (isBaseFork) {
    return BASE_GOVERNOR;
  } else if (isSonicFork) {
    return SONIC_GOVERNOR;
  } else if (isBNBFork) {
    return BNB_GOVERNOR;
  } else if (isHoleskyFork) {
    return HOLESKY_DEPLOYER;
  } else if (isMainnetFork) {
    return MAINNET_GOVERNOR;
  }

  return fallbackAccountIndex;
}

const getStrategistAddressOrIndex = (fallbackAccountIndex = 2) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }

  if (isHoleskyFork) {
    return HOLESKY_DEPLOYER;
  } else if (isBaseFork) {
    return BASE_STRATEGIST;
  } else if (isSonicFork) {
    return SONIC_STRATEGIST;
  } else if (isBNBFork) {
    return BNB_STRATEGIST;
  }

  return MAINNET_STRATEGIST;
}

const getTimelockAddress = () => {
  if (process.env.FORK !== "true") {
    return ethers.constants.AddressZero;
  }

  if (process.env.FORK_NETWORK_NAME == "base") {
    return BASE_TIMELOCK;
  } else if (process.env.FORK_NETWORK_NAME == "mainnet" || (!process.env.FORK_NETWORK_NAME && process.env.FORK == "true")) {
    return MAINNET_TIMELOCK;
  }

  return ethers.constants.AddressZero;
}

const getDeployTags = () => {
  if (isArbitrumFork) {
    return { tags: ["arbitrumOne"] };
  } else if (isBaseFork) {
    return { tags: ["base"] };
  } else if (isSonicFork) {
    return { tags: ["sonic"] };
  } else if (isBNBFork) {
    return { tags: ["bnb"] };
  }
  return {};
}

const defaultAccountConfig = [
  process.env.DEPLOYER_PK || privateKeys[0],
  process.env.GOVERNOR_PK || privateKeys[0],
];

module.exports = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  tracer: {
    nameTags: {
      "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer Vault",
      "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b": "Uniswap Universal Router",
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      blockGasLimit: 1000000000,
      allowUnlimitedContractSize: true,
      chainId,
      ...getDeployTags(),
      ...(isForkTest
        ? {
            timeout: 0,
            initialBaseFeePerGas: 0,
            forking: {
              enabled: true,
              url: provider,
              blockNumber: forkBlockNumber
                ? parseInt(forkBlockNumber)
                : undefined,
              timeout: 0,
            },
          }
        : {
            initialBaseFeePerGas: 0,
            gas: 7000000,
            gasPrice: 1000,
          }),
    },
    localhost: {
      timeout: 0,
      ...getDeployTags(),
    },
    mainnet: {
      url: `${process.env.PROVIDER_URL}`,
      accounts: defaultAccountConfig,
    },
    holesky: {
      url: holeskyProviderUrl,
      accounts: defaultAccountConfig,
      chainId: 17000,
      live: true,
    },
    arbitrumOne: {
      url: arbitrumProviderUrl,
      accounts: defaultAccountConfig,
      chainId: 42161,
      tags: ["arbitrumOne"],
      live: true,
      saveDeployments: true,
      // Fails if gas limit is anything less than 20M on Arbitrum One
      gas: 20000000,
      // initialBaseFeePerGas: 0,
    },
    base: {
      url: baseProviderUrl,
      accounts: defaultAccountConfig,
      chainId: 8453,
      tags: ["base"],
      live: true,
      saveDeployments: true,
    },
    sonic: {
      url: sonicProviderUrl,
      accounts: defaultAccountConfig,
      chainId: 146,
      tags: ["sonic"],
      live: true,
      saveDeployments: true,
    },
    bnb: {
      url: bnbProviderUrl,
      accounts: defaultAccountConfig,
      chainId: 56,
      tags: ["bnb"],
      live: true,
      saveDeployments: true,
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
    timeout: parseInt(process.env.MOCHA_TIMEOUT) || 40000,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      localhost: getDeployerAddressOrIndex(),
      hardhat: getDeployerAddressOrIndex(),
      mainnet: MAINNET_DEPLOYER,
      arbitrumOne: MAINNET_DEPLOYER,
      holesky: HOLESKY_DEPLOYER,
      base: BASE_DEPLOYER,
      sonic: SONIC_DEPLOYER,
    },
    governorAddr: {
      default: 1,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        getGovernorAddressOrIndex(),
      hardhat:
        getGovernorAddressOrIndex(),
      mainnet: MAINNET_GOVERNOR,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the governor
      base: BASE_GOVERNOR,
      sonic: SONIC_GOVERNOR,
    },
    /* Local node environment currently has no access to Decentralized governance
     * address, since the contract is in another repo. Once we merge the ousd-governance
     * and this repo, it will be able to fetch the address from the deployed governance contract.
     *
     * Even then in local node environment the `governorFiveAddr` named account
     * is not to be used. Should only be used in forked and mainnet environments.
     */
    governorFiveAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? MAINNET_GOVERNOR_FIVE
          : ethers.constants.AddressZero,
      hardhat:
        process.env.FORK === "true"
          ? MAINNET_GOVERNOR_FIVE
          : ethers.constants.AddressZero,
      mainnet: MAINNET_GOVERNOR_FIVE,
    },
    // Above governorFiveAddr comment applies to governorSix as well
    governorSixAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        process.env.FORK === "true"
          ? addresses.mainnet.GovernorSix
          : ethers.constants.AddressZero,
      hardhat:
        process.env.FORK === "true"
          ? addresses.mainnet.GovernorSix
          : ethers.constants.AddressZero,
      mainnet: addresses.mainnet.GovernorSix,
    },
    // Above governorFiveAddr comment applies to timelock as well
    timelockAddr: {
      default: ethers.constants.AddressZero,
      // On Mainnet and fork, the governor is the Governor contract.
      localhost:
        getTimelockAddress(),
      hardhat:
        getTimelockAddress(),
      mainnet: MAINNET_TIMELOCK,
      base: BASE_TIMELOCK,
      sonic: addresses.sonic.timelock,
    },
    guardianAddr: {
      default: 1,
      // On mainnet and fork, the guardian is the multi-sig.
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
    },
    adjusterAddr: {
      default: 0,
      localhost: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      hardhat: process.env.FORK === "true" ? MAINNET_CLAIM_ADJUSTER : 0,
      mainnet: MAINNET_CLAIM_ADJUSTER,
    },
    strategistAddr: {
      default: 0,
      localhost: getStrategistAddressOrIndex(),
      hardhat: getStrategistAddressOrIndex(),
      mainnet: MAINNET_STRATEGIST,
      holesky: HOLESKY_DEPLOYER, // on Holesky the deployer is also the strategist
      base: BASE_STRATEGIST,
      sonic: SONIC_STRATEGIST,
      bnb: BNB_STRATEGIST,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: process.env.CONTRACT_SIZE ? true : false,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      holesky: process.env.ETHERSCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      sonic: process.env.SONICSCAN_API_KEY,
      bnb: process.env.BNBSCAN_API_KEY,
    },
    customChains: [
      {
        network: "holesky",
        chainId: 17000,
        urls: {
          apiURL: "https://api-holesky.etherscan.io/api",
          browserURL: "https://holesky.etherscan.io",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
      {
        network: "bnb",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  paths,
};
