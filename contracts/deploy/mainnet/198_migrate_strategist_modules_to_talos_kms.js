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
      name: "Grant the OPERATOR_ROLE of all strategist safe modules to the new Talos signer.",
      actions: modules.map((cModule) => ({
        contract: cModule,
        signature: "grantRole(bytes32,address)",
        args: [OPERATOR_ROLE, addresses.talosRelayer],
      })),
    };
  }
);
