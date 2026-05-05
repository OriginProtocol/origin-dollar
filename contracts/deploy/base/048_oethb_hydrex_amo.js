const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployOETHbHydrexAMOStrategyImplementation,
} = require("../deployActions");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// BLOCKED: this script is a no-op until `addresses.base.HydrexOETHb_WETH.gauge`
// is set to the live Hydrex GaugeV2 for the superOETHb/WETH pool. Before
// unblocking, also re-verify that `gauge.rewardToken() == addresses.base.HYDX`.
module.exports = deployOnBase(
  {
    deployName: "048_oethb_hydrex_amo",
  },
  async ({ deployWithConfirmation, ethers }) => {
    if (addresses.base.HydrexOETHb_WETH.gauge === ZERO_ADDRESS) {
      console.log(
        "Skipping 048_oethb_hydrex_amo: Hydrex gauge for superOETHb/WETH " +
          "is not yet deployed. Set addresses.base.HydrexOETHb_WETH.gauge " +
          "to the live gauge address before re-running this deploy."
      );
      return { actions: [] };
    }

    // 1. Deploy the OETHb Hydrex AMO proxy
    await deployWithConfirmation("OETHbHydrexAMOProxy");
    const cOETHbHydrexAMOProxy = await ethers.getContract(
      "OETHbHydrexAMOProxy"
    );

    // 2. Deploy & initialize the OETHb Hydrex AMO strategy implementation
    const cOETHbHydrexAMOStrategy =
      await deployOETHbHydrexAMOStrategyImplementation();

    // 3. Connect to the OETHBase Vault as IVault
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cVault = await ethers.getContractAt(
      "IVault",
      cOETHBaseVaultProxy.address
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
        // Set the harvester address on the strategy
        {
          contract: cOETHbHydrexAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.base.multichainStrategist],
        },
      ],
    };
  }
);
