usePlugin("@nomiclabs/buidler-waffle");
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

module.exports = {
  solc: {
    version: "0.5.16",
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
