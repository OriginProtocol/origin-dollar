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
    deployName: "052_upgrade_ousd_vault_harvester",
    forceDeploy: false,
    onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true,
  },
  async ({ assetAddresses, deployWithConfirmation, ethers }) => {
    if (isMainnet) {
      throw new Error("Delete once sure to update OUSD contracts");
    }

    // Deploy VaultAdmin and VaultCore contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dVaultCore = await deployWithConfirmation("VaultCore");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Deploy Oracle Router
    const dOracleRouter = await deployWithConfirmation("OracleRouter");
    const cOracleRouter = await ethers.getContract("OracleRouter");

    // Cache decimals of all vault assets and rewards
    await cOracleRouter.cacheDecimals(addresses.mainnet.DAI);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDC);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDT);
    await cOracleRouter.cacheDecimals(addresses.mainnet.COMP);
    await cOracleRouter.cacheDecimals(addresses.mainnet.Aave);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CRV);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CVX);

    // Deploy Harvester
    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const dHarvester = await deployWithConfirmation("Harvester", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);

    const cSwapper = await ethers.getContract("Swapper1InchV5");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Vault contracts and cache the decimals of all supported assets",
      actions: [
        // 1. Upgrade the OUSD Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OUSD Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Set the Swapper on the OUSD Vault
        {
          contract: cVault,
          signature: "setSwapper(address)",
          args: [cSwapper.address],
        },
        // 4. Set the Price Provider on the OUSD Vault
        {
          contract: cVault,
          signature: "setPriceProvider(address)",
          args: [dOracleRouter.address],
        },
        // 5. Cache the decimals of all supported assets
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.DAI],
        },
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDT],
        },
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDC],
        },
        // 6. Set the allowed oracle slippages for each vault collateral asset to 0.25%
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.DAI, 25],
        },
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.USDC, 25],
        },
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.USDT, 25],
        },
        // 7. Set max allowed percentage the vault total value can drop below the OToken total supply when executing collateral swaps.
        {
          contract: cVault,
          signature: "setSwapAllowedUndervalue(uint16)",
          args: [50], // 0.5%
        },
        // 8. Set the Harvester on the OUSD Vault
        {
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvester.address],
        },
      ],
    };
  }
);
