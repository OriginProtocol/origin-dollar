const addresses = require("../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "074_upgrade_oeth_oracle_router",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: true,
    proposalId:
      "106278417454867451974813715923399219935127486408733818981463241122477926429090",
  },
  async () => {
    // Current OETH Vault contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deploy the new Router
    await deployWithConfirmation("OETHOracleRouter");
    const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");

    // Cache decimals of all known tokens
    await withConfirmation(
      // CRV/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.CRV)
    );

    await withConfirmation(
      // CVX/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.CVX)
    );

    await withConfirmation(
      // rETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.rETH)
    );

    await withConfirmation(
      // stETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.stETH)
    );

    await withConfirmation(
      // frxETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.frxETH)
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Add frxETH price feed to OETH Oracle Router",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setPriceProvider(address)",
          args: [cOETHOracleRouter.address],
        },
      ],
    };
  }
);
