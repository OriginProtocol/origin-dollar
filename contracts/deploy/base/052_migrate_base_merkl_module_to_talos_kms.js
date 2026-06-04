const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// The Base MerklPoolBoosterBribesModule is admined by the multichainStrategist
// 2/8 Safe (its DEFAULT_ADMIN_ROLE holder), so granting OPERATOR_ROLE to the new
// Talos signer is a plain Safe transaction
module.exports = deploymentWithGnosisSafe(
  {
    deployName: "052_migrate_base_merkl_module_to_talos",
    safe: addresses.multichainStrategist,
    network: "base",
    forceDeploy: false,
  },
  async () => {
    const cMerklModule = await ethers.getContractAt(
      "MerklPoolBoosterBribesModule",
      addresses.base.MerklPoolBoosterBribesModule
    );

    const OPERATOR_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );

    return {
      name: "Grant the OPERATOR_ROLE of the Base MerklPoolBoosterBribesModule to the new Talos signer.",
      actions: [
        {
          contract: cMerklModule,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
      ],
    };
  }
);
