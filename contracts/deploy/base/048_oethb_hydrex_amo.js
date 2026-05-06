const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployOETHbHydrexAMOStrategyImplementation,
} = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "048_oethb_hydrex_amo",
  },
  async ({ deployWithConfirmation, ethers }) => {
    // 1. Deploy the OETHb Hydrex AMO proxy
    await deployWithConfirmation("OETHbHydrexAMOProxy");
    const cOETHbHydrexAMOProxy = await ethers.getContract(
      "OETHbHydrexAMOProxy"
    );

    // 2. Deploy & initialize the strategy implementation against the live
    //    Hydrex gauge configured in addresses.base.HydrexOETHb_WETH.gauge.
    const cOETHbHydrexAMOStrategy =
      await deployOETHbHydrexAMOStrategyImplementation(
        addresses.base.HydrexOETHb_WETH.gauge
      );

    // 3. Connect to the OETHBase Vault as IVault
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cVault = await ethers.getContractAt(
      "IVault",
      cOETHBaseVaultProxy.address
    );

    // 4. Connect to the OETHBase harvester proxy. Use the same harvester
    //    that AerodromeAMOStrategy uses (OETHHarvesterSimple via the
    //    OETHBaseHarvesterProxy) so reward token flows go through the
    //    standard Origin harvester pipeline.
    const cHarvesterProxy = await ethers.getContract("OETHBaseHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cHarvesterProxy.address
    );

    return {
      name: "Deploy OETHb Hydrex AMO Strategy on Base",
      actions: [
        // Approve the strategy on the OETHBase Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cOETHbHydrexAMOProxy.address],
        },
        // Allow the strategy to mint OETHb via the Vault
        {
          contract: cVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cOETHbHydrexAMOProxy.address],
        },
        // Set the harvester address on the strategy. Rewards (oHYDX) flow
        // strategy → harvester → strategist via OETHHarvesterSimple's
        // harvestAndTransfer.
        {
          contract: cOETHbHydrexAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // Mark the strategy as supported on the harvester so
        // harvestAndTransfer(strategy) doesn't revert.
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cOETHbHydrexAMOProxy.address, true],
        },
      ],
    };
  }
);
