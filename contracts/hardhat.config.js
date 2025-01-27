const ethers = require("ethers");
const { task } = require("hardhat/config");
const {
  isForkTest,
  baseProviderUrl,
  sonicProviderUrl,
  arbitrumProviderUrl,
  holeskyProviderUrl,
  bnbProviderUrl,
  adjustTheForkBlockNumber,
  getHardhatNetworkProperties,
} = require("./utils/hardhat-helpers.js");

require("@nomicfoundation/hardhat-verify");
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
const MAINNET_GOVERNOR_FIVE = "0x3cdd07c16614059e66344a7b579dab4f9516c0b6";
const MAINNET_TIMELOCK = "0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F";
const MAINNET_GOVERNOR = "0x72426ba137dec62657306b12b1e869d43fec6ec7";
// 5/8 multi-sig that controls the Governor. Aka "Admin".
const MAINNET_MULTISIG = "0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899";
const MAINNET_CLAIM_ADJUSTER = MAINNET_DEPLOYER;
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const MAINNET_STRATEGIST = "0xf14bbdf064e3f67f51cd9bd646ae3716ad938fdc";
const HOLESKY_DEPLOYER = "0x1b94CA50D3Ad9f8368851F8526132272d1a5028C";

const BASE_DEPLOYER = MAINNET_DEPLOYER;
// 5/8 multi-sig that controls the Timelock. Aka "Admin".
const BASE_GOVERNOR = "0x92A19381444A001d62cE67BaFF066fA1111d7202";
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const BASE_STRATEGIST = "0x28bce2eE5775B652D92bB7c2891A89F036619703";

const BASE_TIMELOCK = "0xf817cb3092179083c48c014688D98B72fB61464f";

const SONIC_DEPLOYER = MAINNET_DEPLOYER;
// 5/8 multi-sig that controls the Timelock. Aka "Admin".
const SONIC_ADMIN = "0xAdDEA7933Db7d83855786EB43a238111C69B00b6";
// 2/8 multi-sig that controls fund allocations. Aka "Guardian".
const SONIC_STRATEGIST = "0x63cdd3072F25664eeC6FAEFf6dAeB668Ea4de94a";

const SONIC_TIMELOCK = "0x31a91336414d3B955E494E7d485a6B06b55FC8fB";

const BNB_GOVERNOR = MAINNET_DEPLOYER;
const BNB_STRATEGIST = MAINNET_DEPLOYER;
const BNB_DEPLOYER = MAINNET_DEPLOYER;

const MULTICHAIN_STRATEGIST = "0x4FF1b9D9ba8558F5EAfCec096318eA0d8b541971";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];
let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

const getDeployerAddressOrIndex = (fallbackAccountIndex = 0) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }
  return (
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.addresses?.deployer || MAINNET_DEPLOYER
  );
};

const getGovernorAddressOrIndex = (fallbackAccountIndex = 1) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }

  return (
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.addresses?.governor || MAINNET_GOVERNOR
  );
};

const getStrategistAddressOrIndex = (fallbackAccountIndex = 2) => {
  if (process.env.FORK !== "true") {
    return fallbackAccountIndex;
  }

  return (
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.addresses?.strategist || MAINNET_STRATEGIST
  );
};

const getTimelockAddress = () => {
  if (process.env.FORK !== "true") {
    return ethers.constants.AddressZero;
  }

  return (
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.addresses?.timelock || ethers.constants.AddressZero
  );
};

const getDeployTags = () => {
  const tags =
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.tags || [];

  return { tags };
};

// Define network configurations
const networkConfigs = [
  {
    name: "mainnet",
    networkConfig: {
      url: process.env.PROVIDER_URL,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 1,
      live: true,
      tags: [],
    },
    deployPath: "deploy/mainnet",
    addresses: {
      deployer: MAINNET_DEPLOYER,
      governor: MAINNET_GOVERNOR,
      timelock: MAINNET_TIMELOCK,
    },
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
    },
  },
  {
    name: "holesky",
    networkConfig: {
      url: holeskyProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 17000,
      live: true,
      tags: [],
    },
    deployPath: "deploy/holesky",
    addresses: {
      deployer: HOLESKY_DEPLOYER,
    },
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY,
      customChain: {
        network: "holesky",
        chainId: 17000,
        urls: {
          apiURL: "https://api-holesky.etherscan.io/api",
          browserURL: "https://holesky.etherscan.io",
        },
      },
    },
  },
  {
    name: "arbitrumOne",
    networkConfig: {
      url: arbitrumProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 42161,
      live: true,
      tags: ["arbitrumOne"],
      gas: 20000000,
    },
    deployPath: "deploy/arbitrumOne",
    etherscan: {
      apiKey: process.env.ARBISCAN_API_KEY,
    },
  },
  {
    name: "base",
    networkConfig: {
      url: baseProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 8453,
      live: true,
      tags: ["base"],
      gas: 20000000,
    },
    deployPath: "deploy/base",
    addresses: {
      deployer: BASE_DEPLOYER,
      governor: BASE_GOVERNOR,
      timelock: BASE_TIMELOCK,
    },
    etherscan: {
      apiKey: process.env.BASESCAN_API_KEY,
      customChain: {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    },
  },
  {
    name: "sonic",
    networkConfig: {
      url: sonicProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 146,
      live: true,
      tags: ["sonic"],
    },
    deployPath: "deploy/sonic",
    addresses: {
      deployer: SONIC_DEPLOYER,
      governor: SONIC_ADMIN,
      timelock: SONIC_TIMELOCK,
    },
    etherscan: {
      apiKey: process.env.SONICSCAN_API_KEY,
      customChain: {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
    },
  },
  {
    name: "bnb",
    networkConfig: {
      url: bnbProviderUrl,
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
      chainId: 56,
      live: true,
      tags: ["bnb"],
    },
    deployPath: "deploy/bnb",
    addresses: {
      deployer: BNB_DEPLOYER,
      governor: BNB_GOVERNOR,
    },
    etherscan: {
      apiKey: process.env.BNBSCAN_API_KEY,
      customChain: {
        network: "bnb",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://bscscan.com",
        },
      },
    },
  },
];

// Build networks configuration
const networks = networkConfigs.reduce((acc, { name, networkConfig }) => {
  acc[name] = networkConfig;
  return acc;
}, {});

const { provider, chainId } = getHardhatNetworkProperties();
const forkBlockNumber = adjustTheForkBlockNumber();

networks.hardhat = {
  accounts: { mnemonic },
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
          blockNumber: forkBlockNumber ? parseInt(forkBlockNumber) : undefined,
          timeout: 0,
        },
      }
    : {
        initialBaseFeePerGas: 0,
        gas: 7000000,
        gasPrice: 1000,
      }),
};

networks.localhost = {
  timeout: 0,
};

// Account tasks.
task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  return accounts(taskArguments, hre, privateKeys);
});

const paths = {
  deploy:
    networkConfigs.find(({ name }) => {
      return (
        process.env.NETWORK_NAME == name ||
        process.env.FORK_NETWORK_NAME == name
      );
    })?.deployPath || "deploy/mainnet",
  cache: process.env.HARDHAT_CACHE_DIR || undefined,
};

module.exports = {
  solidity: {
    version: "0.8.28",
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
  networks,
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
      localhost: getGovernorAddressOrIndex(),
      hardhat: getGovernorAddressOrIndex(),
      mainnet: MAINNET_GOVERNOR,
      holesky: HOLESKY_DEPLOYER,
      base: BASE_GOVERNOR,
      sonic: SONIC_ADMIN,
    },
    governorFiveAddr: {
      default: ethers.constants.AddressZero,
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
    governorSixAddr: {
      default: ethers.constants.AddressZero,
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
    timelockAddr: {
      default: ethers.constants.AddressZero,
      localhost: getTimelockAddress(),
      hardhat: getTimelockAddress(),
      mainnet: MAINNET_TIMELOCK,
      base: BASE_TIMELOCK,
      sonic: addresses.sonic.timelock,
    },
    guardianAddr: {
      default: 1,
      localhost: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      hardhat: process.env.FORK === "true" ? MAINNET_MULTISIG : 1,
      mainnet: MAINNET_MULTISIG,
      base: MAINNET_MULTISIG,
      sonic: SONIC_ADMIN,
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
      holesky: HOLESKY_DEPLOYER,
      base: BASE_STRATEGIST,
      sonic: SONIC_STRATEGIST,
      bnb: BNB_STRATEGIST,
    },
    multichainStrategistAddr: {
      default: MULTICHAIN_STRATEGIST,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: process.env.CONTRACT_SIZE ? true : false,
  },
  etherscan: {
    apiKey: networkConfigs.reduce((acc, { name, etherscan }) => {
      acc[name] = etherscan.apiKey;
      return acc;
    }, {}),
    customChains: networkConfigs
      .filter(({ etherscan }) => etherscan.customChain)
      .map(({ etherscan }) => etherscan.customChain),
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  sourcify: {
    enabled: true,
  },
  paths,
};
