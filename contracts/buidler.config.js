const ethers = require("ethers");
const addresses = require("./utils/addresses");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");
usePlugin("solidity-coverage");
usePlugin("buidler-gas-reporter");
usePlugin('buidler-contract-sizer');

if (process.env.FORK && !process.env.PROVIDER_URL) {
  throw new Error(
    "You must set the PROVIDER_URL env var when running ganache in fork mode"
  );
}

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
  async (taskArguments, bre) => {
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

task("accounts", "Prints the list of accounts", async (taskArguments, bre) => {
  const accounts = await bre.ethers.getSigners();
  const roles = ["Deployer", "Governor"];

  const isMainnetOrRinkeby = ["mainnet", "rinkeby"].includes(bre.network.name);
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

// Convert mnemonic into private keys for buidlerevm network config
module.exports = {
  solc: {
    version: "0.5.11",
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
    buidlerevm: {
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
      fork: process.env.FORK ? process.env.PROVIDER_URL : null,
      mnemonic,
      unlocked_accounts: process.env.FORK ? [] : [addresses.mainnet.Binance],
      chainId: 1337,
      // logger: console,
      // verbose: true,
    },
    coverage: {
      url: "http://localhost:8555",
    },
  },
  mocha: {
    // bail: true,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
    },
    governorAddr: {
      default: 1,
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
};
