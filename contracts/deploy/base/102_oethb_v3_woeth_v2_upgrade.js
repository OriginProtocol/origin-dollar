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

    const masterProxyAddress = await getCreate2ProxyAddress(
      "OETHbV3MasterProxy"
    );
    console.log(`Master (Base) resolved at: ${masterProxyAddress}`);

    // The Remote proxy address on Ethereum is identical to the Master proxy address
    // when both are deployed via CreateX with the same salt + the same hardcoded
    // CreateX "origin-protocol" sentinel. The constructor takes the deployer EOA,
    // so production must use the same deployer key on both chains for parity.
    const remoteProxyAddress = masterProxyAddress;
    console.log(`Remote (Ethereum) expected at: ${remoteProxyAddress}`);

    // --- Deploy V2 impl matching the V1 constructor footprint ---
    await deployWithConfirmation("BridgedWOETHStrategyV2", [
      [addresses.zero, cOETHBaseVaultProxy.address],
      addresses.base.WETH,
      addresses.base.BridgedWOETH,
      cOETHb.address,
      cOracleRouter.address,
    ]);
    const dV2Impl = await ethers.getContract("BridgedWOETHStrategyV2");
    console.log(`BridgedWOETHStrategyV2 impl: ${dV2Impl.address}`);

    return {
      name: "Upgrade BridgedWOETHStrategy V1 → V2 + wire CCIP for the migration",
      actions: [
        // 1. Upgrade the existing proxy to V2.
        {
          contract: cBridgedWOETHStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dV2Impl.address],
        },
        // 2. Wire V2-specific state: master ref + CCIP config + maxPerBridge.
        {
          contract: await ethers.getContractAt(
            "BridgedWOETHStrategyV2",
            cBridgedWOETHStrategyProxy.address
          ),
          signature: "initializeV2(address,address,uint64,address,uint256)",
          args: [
            masterProxyAddress,
            addresses.base.CCIPRouter,
            CCIP_CHAIN_SELECTOR_MAINNET,
            remoteProxyAddress,
            MAX_PER_BRIDGE,
          ],
        },
      ],
    };
  }
);
