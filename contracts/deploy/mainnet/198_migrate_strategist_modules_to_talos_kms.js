const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// the governor to execute this proposal is 2/8 Cross chain strategist
module.exports = deploymentWithGnosisSafe(
  {
    deployName: "198_migrate_strategist_modules_to_talos",
    safe: addresses.multichainStrategist,
    forceDeploy: false,
  },
  async () => {
    const moduleNames = [
      "ClaimStrategyRewardsSafeModule",
      "AutoWithdrawalModule",
      "MerklPoolBoosterBribesModule",
      "CurvePoolBoosterBribesModule",
    ];
    const modules = [];
    for (const name of moduleNames) {
      modules.push(await ethers.getContract(name));
    }

    const OPERATOR_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );

    return {
      name: "Grant the OPERATOR_ROLE of all strategist safe modules to the new Talos signer, and revoke it from the old relayer.",
      // grantRole is additive — the old relayer keeps OPERATOR_ROLE, so for each
      // module grant the new signer AND revoke the old relayer.
      actions: modules.flatMap((cModule) => [
        {
          contract: cModule,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
        {
          contract: cModule,
          signature: "revokeRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.mainnet.validatorRegistrator],
        },
      ]),
    };
  }
);
