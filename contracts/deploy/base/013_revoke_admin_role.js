const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = deployOnBase(
  {
    deployName: "013_revoke_admin_role",
  },
  async ({ ethers }) => {
    const cBridgedWOETHProxy = await ethers.getContract(
      "BridgedBaseWOETHProxy"
    );
    const cBridgedWOETH = await ethers.getContractAt(
      "BridgedWOETH",
      cBridgedWOETHProxy.address
    );

    return {
      actions: [
        {
          // 1. Revoke admin role from multisig on Bridged wOETH
          contract: cBridgedWOETH,
          signature: "revokeRole(bytes32,address)",
          args: [ADMIN_ROLE, addresses.base.governor],
        },
      ],
    };
  }
);
