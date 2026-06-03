const addresses = require("../../utils/addresses");
const { deploymentWithGuardianGovernor } = require("../../utils/deploy");

// CollectXOGNRewardsModule6 is admined by the mainnet Guardian 5/8 Safe (its
// DEFAULT_ADMIN_ROLE holder), so the operator migration is executed by that Safe
// directly — a different signing entity than the GovernorSix -> Timelock used in
// deploy 196, hence a separate deploy file.
module.exports = deploymentWithGuardianGovernor(
  {
    deployName: "197_migrate_xogn_module6_to_talos",
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
