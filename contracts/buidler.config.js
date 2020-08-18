const addresses = require("./utils/addresses");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("buidler-ethers-v5");
usePlugin("buidler-deploy");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

const infura = "https://mainnet.infura.io/v3/988930c507b9488a82849f5d16c0ca13";

const mnemonic =
  "replace hover unaware super where filter stone fine garlic address matrix basic";

module.exports = {
  solc: {
    version: "0.5.17",
  },
  networks: {
    buidlerevm: {
      allowUnlimitedContractSize: true,
    },
    ganache: {
      url: "http://localhost:7546",
      fork: infura,
      mnemonic: mnemonic,
      unlocked_accounts: [addresses.mainnet.Binance],
      logger: console,
      verbose: true,
    },
  },
  mocha: {
    bail: true,
  },
  throwOnTransactionFailures: true,
  namedAccounts: {
    deployerAddr: {
      default: 0,
    },
    governorAddr: {
      default: 1,
    },
    proxyAdminAddr: {
      default: 1,
    },
  },
};
