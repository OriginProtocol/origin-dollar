const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { getCreate2ProxyAddress } = require("../deployActions");

// CCIP chain selector for Ethereum mainnet (Chainlink CCIP docs).
const CCIP_CHAIN_SELECTOR_MAINNET = "5009297550715157269";

// Per-call wOETH bridge cap. Mirrors the CCIP rate-limit budget.
const MAX_PER_BRIDGE = ethers.utils.parseEther("1000");

module.exports = deployOnBase(
  {
    deployName: "102_oethb_v3_woeth_v2_upgrade",
    dependencies: ["101_oethb_v3_master_impl"],
  },
  async ({ deployWithConfirmation, ethers }) => {
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHb = await ethers.getContract("OETHBaseProxy");
    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    const cBridgedWOETHStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    // Master on Base and Remote on Ethereum live at the same address by CreateX parity.
    // The migration impl stores that single address as `master` and uses it both as the
    // local Master read target (`checkBalance` in-flight reconciliation) and the
    // cross-chain CCIP recipient.
    const masterProxyAddress = await getCreate2ProxyAddress(
      "OETHbV3MasterProxy"
    );
    console.log(
      `Master/Remote (CreateX parity) resolved at: ${masterProxyAddress}`
    );

    // --- Deploy migration impl (V1 constructor + master/ccipRouter/chainSelector) ---
    await deployWithConfirmation("BridgedWOETHMigrationStrategy", [
      [addresses.zero, cOETHBaseVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      cOETHb.address,
      cOracleRouter.address,
      masterProxyAddress,
      addresses.base.CCIPRouter,
      CCIP_CHAIN_SELECTOR_MAINNET,
    ]);
    const dMigrationImpl = await ethers.getContract(
      "BridgedWOETHMigrationStrategy"
    );
    console.log(
      `BridgedWOETHMigrationStrategy impl: ${dMigrationImpl.address}`
    );

    const cMigration = await ethers.getContractAt(
      "BridgedWOETHMigrationStrategy",
      cBridgedWOETHStrategyProxy.address
    );

    return {
      name: "Upgrade BridgedWOETHStrategy → BridgedWOETHMigrationStrategy + wire CCIP",
      actions: [
        // 1. Upgrade the existing proxy.
        {
          contract: cBridgedWOETHStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dMigrationImpl.address],
        },
        // 2. Set the per-call cap. (Governor-or-strategist gate; runs as governance here.)
        {
          contract: cMigration,
          signature: "setMaxPerBridge(uint256)",
          args: [MAX_PER_BRIDGE],
        },
        // 3. Authorise the multichain strategist as the operator for `bridgeToRemote`.
        {
          contract: cMigration,
          signature: "setOperator(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
