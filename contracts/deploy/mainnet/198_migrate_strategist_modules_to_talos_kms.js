const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// All four safe modules are admined by the multichainStrategist 2/8 Safe (their
// DEFAULT_ADMIN_ROLE holder), so granting OPERATOR_ROLE to the new Talos signer
// is a plain Safe transaction batch — a different signing entity than the
// GovernorSix->Timelock (deploy 196) and the Guardian 5/8 Safe (deploy 197).
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
