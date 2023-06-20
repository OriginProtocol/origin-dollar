const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { isMainnet } = require("../test/helpers.js");

module.exports = deploymentWithGovernanceProposal(
  /* IMPORTANT (!)
   *
   * Once this gets deployed undo the `skip` in the `vault.fork-test.js` under
   * the "Should have correct Price Oracle address set" scenario.
   */
  {
    deployName: "052_decimal_cache",
    forceDeploy: false,
    onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true,
  },
  async ({ assetAddresses, deployWithConfirmation, ethers }) => {
    if (isMainnet) {
      throw new Error("Delete once sure to update OUSD contracts");
    }

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dOracleRouter = await deployWithConfirmation("OracleRouter");
    const dVaultCore = await deployWithConfirmation("VaultCore");

    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    const cOracleRouter = await ethers.getContract("OracleRouter");
    await cOracleRouter.cacheDecimals(addresses.mainnet.DAI);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDC);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDT);
    await cOracleRouter.cacheDecimals(addresses.mainnet.COMP);
    await cOracleRouter.cacheDecimals(addresses.mainnet.Aave);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CRV);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CVX);

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const dHarvester = await deployWithConfirmation("Harvester", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);

    const cVaultAdmin = new ethers.Contract(cVaultProxy.address, [
      {
        inputs: [
          {
            internalType: "address",
            name: "_asset",
            type: "address",
          },
        ],
        name: "cacheDecimals",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "_priceProvider",
            type: "address",
          },
        ],
        name: "setPriceProvider",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ]);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new VaultAdmin and cache the decimals of all supported assets",
      actions: [
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.DAI],
        },
        {
          contract: cVaultAdmin,
          signature: "setPriceProvider(address)",
          args: [dOracleRouter.address],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDT],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDC],
        },
        {
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvester.address],
        },
        {
          // Set new implementation
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
      ],
    };
  }
);
