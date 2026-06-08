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
      name: "Grant the OPERATOR_ROLE of CollectXOGNRewardsModule6 to the new Talos signer, and revoke it from the old relayer.",
      actions: [
        {
          contract: cCollectXOGNRewardsModule6,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
        // grantRole is additive — the old relayer keeps OPERATOR_ROLE, so revoke it.
        {
          contract: cCollectXOGNRewardsModule6,
          signature: "revokeRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.mainnet.validatorRegistrator],
        },
      ],
    };
  }
);
