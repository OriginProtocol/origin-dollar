const {
  deploymentWithGovernanceProposal,
  withConfirmation,
} = require("../utils/deploy");
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
    forceSkip: false,
    onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
    //   "",
  },
  async ({ assetAddresses, deployWithConfirmation, ethers }) => {
    if (isMainnet) {
      throw new Error("Delete once sure to update OUSD contracts");
    }

    // Deploy VaultAdmin and VaultCore contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    // const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    // TODO uncomment the previous line and remove the following once the proposal has been created
    const dVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      "0x8b39590a49569dD5489E4186b8DD43069d4Ef0cC"
    );
    // const dVaultCore = await deployWithConfirmation("VaultCore");
    // TODO uncomment the previous line and remove the following once the proposal has been created
    const dVaultCore = await ethers.getContractAt(
      "VaultCore",
      "0x0adD23eCF2Ef9f4be557C52E75A5beDCdD070d34"
    );
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Deploy Oracle Router
    // const dOracleRouter = await deployWithConfirmation("OracleRouter");
    // TODO uncomment the previous line and remove the following once the proposal has been created
    const dOracleRouter = await ethers.getContractAt(
      "OracleRouter",
      "0xe7fD05515A51509Ca373a42E81ae63A40AA4384b"
    );
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
    // const dHarvester = await deployWithConfirmation("Harvester", [
    //   cVaultProxy.address,
    //   assetAddresses.USDT,
    // ]);
    // TODO uncomment the previous line and remove the following once the proposal has been created
    const dHarvester = await ethers.getContractAt(
      "Harvester",
      "0x6aD90cB172001eE0096Bb758c617F5cba5163687"
    );

    const cSwapper = await ethers.getContract("Swapper1InchV5");

    // // The 1Inch Swapper contract approves the 1Inch Router to transfer OUSD collateral assets
    // TODO uncomment the following once the proposal has been created
    // await withConfirmation(
    //   cSwapper.approveAssets([
    //     assetAddresses.DAI,
    //     assetAddresses.USDC,
    //     assetAddresses.USDT,
    //   ])
    // );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OUSD Vault with new VaultCore and VaultAdmin contracts.\n\
Set new Oracle router.\n\
Configure OUSD Vault to perform collateral swaps.\n\
Upgrade the OUSD Harvester\n\
\n\
Code PR: #1767",
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
        // 8. Upgrade the OUSD Harvester
        {
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvester.address],
        },
      ],
    };
  }
);
