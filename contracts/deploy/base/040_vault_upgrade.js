const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "040_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    // 1. Deploy OETHBaseVault implementations
    const dOETHbVault = await deployWithConfirmation(
      "OETHBaseVault",
      [addresses.base.WETH],
      "OETHBaseVault",
      true
    );

    // 2. Connect to the OETHBase Vault as its governor via the proxy
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    console.log("OETHb Vault Proxy Address:", cOETHbVaultProxy.address);
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    // 3. Connect to the Aerodrome AMO
    const defaultStrategy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );

    // 4. Connect to Bridged WOETH Strategy
    const bridgedWOETHStrategy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    // 5. Connect to oracle router
    const cOracleRouter = await ethers.getContract("OETHBaseOracleRouter");

    // 6. Connect to OETHb Proxy
    const cOETHbtProxy = await ethers.getContract("OETHBaseProxy");

    // 7. Deploy new Bridged WOETH Strategy implementation (with oracle as immutable)
    const dStrategyImpl = await deployWithConfirmation("BridgedWOETHStrategy", [
      [addresses.zero, cOETHbVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      cOETHbtProxy.address,
      cOracleRouter.address,
    ]);

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETHBaseVault to new single Vault implementations",
      actions: [
        // 1. Upgrade Bridged WOETH Strategy implementation
        {
          contract: bridgedWOETHStrategy,
          signature: "upgradeTo(address)",
          args: [dStrategyImpl.address],
        },
        // 2. Upgrade OETHBaseVaultProxy to new implementation
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVault.address],
        },
        // 3. Set Aerodrome AMO as default strategy
        {
          contract: cOETHbVault,
          signature: "setDefaultStrategy(address)",
          args: [defaultStrategy.address],
        },
      ],
    };
  }
);
