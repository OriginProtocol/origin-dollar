const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// the governor to execute this proposal is Gnosis 5/8 Multisig
module.exports = deploymentWithGnosisSafe(
  {
    deployName: "197_migrate_xogn_module6_to_talos",
    safe: addresses.mainnet.Guardian,
    forceDeploy: false,
  },
  async () => {
    const cCollectXOGNRewardsModule6 = await ethers.getContract(
      "CollectXOGNRewardsModule6"
    );

    const OPERATOR_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );

    return {
      name: "Grant the OPERATOR_ROLE of CollectXOGNRewardsModule6 to the new Talos signer.",
      actions: [
        {
          contract: cCollectXOGNRewardsModule6,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
      ],
    };
  }
);
