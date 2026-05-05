const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { isBaseForkTest } = require("../../utils/hardhat-helpers");
const {
  deployOETHbHydrexAMOStrategyImplementation,
} = require("../deployActions");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = deployOnBase(
  {
    deployName: "048_oethb_hydrex_amo",
  },
  async ({ deployWithConfirmation, ethers }) => {
    let gaugeAddress = addresses.base.HydrexOETHb_WETH.gauge;

    // Mock gauge fallback path. ONLY allowed in Base fork tests. Any other
    // Base context (live mainnet deploy, local fork node, anything where
    // IS_TEST !== "true") must hard-fail so a strategy backed by a mock or
    // zero gauge can never escape into production.
    if (gaugeAddress === ZERO_ADDRESS) {
      if (!isBaseForkTest) {
        throw new Error(
          "Hydrex gauge for superOETHb/WETH is not deployed yet. Refusing " +
            "to deploy the strategy with a placeholder/mock gauge outside of " +
            "Base fork tests. Set addresses.base.HydrexOETHb_WETH.gauge to " +
            "the live Hydrex GaugeV2 (and confirm gauge.rewardToken() == " +
            "addresses.base.HYDX) before running this deploy."
        );
      }

      console.warn(
        "USING MOCK HYDREX GAUGE — replace addresses.base.HydrexOETHb_WETH.gauge " +
          "with the live Hydrex GaugeV2 once it has been deployed for the " +
          "superOETHb/WETH pool."
      );

      const { timelockAddr } = await getNamedAccounts();
      await deployWithConfirmation("MockHydrexGauge", [
        addresses.base.HydrexOETHb_WETH.pool,
        addresses.base.HYDX,
        timelockAddr, // owner
        timelockAddr, // distribution
      ]);
      const cMockGauge = await ethers.getContract("MockHydrexGauge");
      gaugeAddress = cMockGauge.address;
    }

    // 1. Deploy the OETHb Hydrex AMO proxy
    await deployWithConfirmation("OETHbHydrexAMOProxy");
    const cOETHbHydrexAMOProxy = await ethers.getContract(
      "OETHbHydrexAMOProxy"
    );

    // 2. Deploy & initialize the strategy implementation against the resolved
    //    gauge address (live or mock).
    const cOETHbHydrexAMOStrategy =
      await deployOETHbHydrexAMOStrategyImplementation(gaugeAddress);

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
