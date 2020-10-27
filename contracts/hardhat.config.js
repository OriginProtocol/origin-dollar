const ethers = require("ethers");

require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-solhint");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("hardhat-deploy-ethers");
// require("solidity-coverage");
// require("buidler-gas-reporter");

const MAINNET_DEPLOYER = "0xAed9fDc9681D61edB5F8B8E421f5cEe8D7F4B04f";
const MAINNET_MULTISIG = "0x52BEBd3d7f37EC4284853Fd5861Ae71253A7F428";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

let privateKeys = [];

let derivePath = "m/44'/60'/0'/0/";
for (let i = 0; i <= 10; i++) {
  const wallet = new ethers.Wallet.fromMnemonic(mnemonic, `${derivePath}${i}`);
  privateKeys.push(wallet.privateKey);
}

task(
  "mainnet_env_vars",
  "Check env vars are properly set for a Mainnet deployment",
  async () => {
    const envVars = ["PROVIDER_URL", "DEPLOYER_PK", "GOVERNOR_PK"];
    for (const envVar of envVars) {
      if (!process.env[envVar]) {
        throw new Error(
          `For Mainnet deploy env var ${envVar} must be defined.`
        );
      }
    }

    if (process.env.PREMIUM_GAS) {
      const percentage = Number(process.env.PREMIUM_GAS);
      if (percentage < 0 || percentage > 30) {
        throw new Error(`Check PREMIUM_GAS. Value out of range.`);
      }
    }
    console.log("All good. Deploy away!");
  }
);

task("accounts", "Prints the list of accounts", async (taskArguments, hre) => {
  const accounts = await hre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(hre.network.name);
  if (isMainnetOrRinkeby) {
    privateKeys = [process.env.DEPLOYER_PK, process.env.GOVERNOR_PK];
  }

  let i = 0;
  for (const account of accounts) {
    const role = roles.length > i ? `[${roles[i]}]` : "";
    const address = await account.getAddress();
    console.log(address, privateKeys[i], role);
    if (!address) {
      throw new Error(`No address defined for role ${role}`);
    }
    i++;
  }
});

module.exports = {
  solidity: {
    version: "0.5.11",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  networks: {
    mainnet: {
      // Using placeholder values for provider url and pks since Buidler does
      // not permit undefined value even if the network is not actively being used.
      url: process.env.PROVIDER_URL || "https://placeholder",
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[0],
        process.env.GOVERNOR_PK || privateKeys[0],
      ],
    },
    rinkeby: {
      url: process.env.PROVIDER_URL || "https://placeholder",
      accounts: [
        process.env.DEPLOYER_PK || privateKeys[1],
        process.env.GOVERNOR_PK || privateKeys[1],
      ],
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 31337,
      accounts: privateKeys.map((privateKey) => {
        return {
          privateKey,
          balance: "10000000000000000000000",
        };
      }),
    },
    ganache: {
      url: "http://localhost:7546",
    },
    fork: {
      url: "http://localhost:7545",
    },
    coverage: {
      url: "http://localhost:8555",
    },
  },
  mocha: {
    bail: process.env.BAIL === "true",
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
      1: MAINNET_DEPLOYER,
      fork: 0,
    },
    governorAddr: {
      default: 1,
      1: MAINNET_MULTISIG,
      fork: MAINNET_MULTISIG,
    },
  },
  gasReporter: {
    currency: "USD",
    // outputFile: 'gasreport.out',
    enabled: Boolean(process.env.GAS_REPORT),
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
