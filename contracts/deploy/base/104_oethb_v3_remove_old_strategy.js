const { deployOnBase } = require("../../utils/deploy-l2");

/**
 * Post-migration cleanup proposal.
 *
 * forceSkip: true — sits in the repo but does not auto-fire when
 * `pnpm run node:base` runs through deploys (the migration would not yet be
 * complete on the fork). Flip `forceSkip` to `false` after all 9x
 * `bridgeToRemote(1000e18)` calls have settled on mainnet — at which point
 * the existing BridgedWOETHStrategy's `checkBalance` will be at or below
 * dust and the vault will accept `removeStrategy`.
 */
module.exports = deployOnBase(
  {
    deployName: "104_oethb_v3_remove_old_strategy",
    forceSkip: true,
  },
  async ({ ethers }) => {
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cVault = await ethers.getContractAt(
      "IVault",
      cOETHBaseVaultProxy.address
    );

    const cBridgedWOETHStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    return {
      name: "Remove old BridgedWOETHStrategy from the OETHb vault post-migration",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cBridgedWOETHStrategyProxy.address],
        },
      ],
    };
  }
);
