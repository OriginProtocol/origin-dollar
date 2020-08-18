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
      fork:
        "https://eth-mainnet.alchemyapi.io/v2/cweL7vuMCrHRZhi4rO227veLANNkWBEo",
      network_id: 999,
      // logger: console,
      mnemonic: mnemonic,
      unlocked_accounts: [addresses.mainnet.Binance],
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
