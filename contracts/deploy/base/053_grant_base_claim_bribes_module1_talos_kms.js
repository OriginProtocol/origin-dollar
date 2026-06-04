const addresses = require("../../utils/addresses");
const { deploymentWithGnosisSafe } = require("../../utils/deploy");

// ClaimBribesSafeModule1 is admined by the ClaimBribes 2/8 Safe (its
// DEFAULT_ADMIN_ROLE holder and immutable safeContract()), so granting
// OPERATOR_ROLE to the new Talos signer is a plain Safe transaction.
module.exports = deploymentWithGnosisSafe(
  {
    deployName: "053_grant_base_claim_bribes_module1_talos",
    network: "base",
    forceDeploy: false,
  },
  async () => {
    const cModule = await ethers.getContract("ClaimBribesSafeModule1");
    const safe = await cModule.safeContract();

    const OPERATOR_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );

    return {
      safe,
      name: "Grant the OPERATOR_ROLE of the Base ClaimBribesSafeModule1 to the new Talos signer.",
      actions: [
        {
          contract: cModule,
          signature: "grantRole(bytes32,address)",
          args: [OPERATOR_ROLE, addresses.talosRelayer],
        },
      ],
    };
  }
);
