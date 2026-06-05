const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// ClaimBribesSafeModule3 is admined by the base.strategist 1/2 Safe (its
// DEFAULT_ADMIN_ROLE holder and immutable safeContract()), so granting
// OPERATOR_ROLE to the new Talos signer is a plain Safe transaction.
module.exports = deploymentWithGnosisSafe(
  {
    deployName: "054_grant_base_claim_bribes_module3_talos",
    network: "base",
    forceDeploy: false,
  },
  async () => {
    const cModule = await ethers.getContract("ClaimBribesSafeModule3");
    const safe = await cModule.safeContract();

    const OPERATOR_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );

    return {
      safe,
      name: "Grant the OPERATOR_ROLE of the Base ClaimBribesSafeModule3 to the new Talos signer, and revoke it from the old relayer.",
      actions: [
        {
          contract: cModule,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
        // grantRole is additive — the old relayer keeps OPERATOR_ROLE, so revoke it.
        {
          contract: cModule,
          signature: "revokeRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.base.OZRelayerAddress],
        },
      ],
    };
  }
);
