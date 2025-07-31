const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "014_wrapped_sonic",
  },
  async ({ ethers }) => {
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const dWOSonicProxy = await ethers.getContract("WOSonicProxy");

    const dWSonicImpl = await deployWithConfirmation("WOSonic", [
      cOSonicProxy.address,
    ]);

    const cWOSonic = await ethers.getContractAt(
      "WOSonic",
      dWOSonicProxy.address
    );

    return {
      actions: [
        // 1. Upgrade WOSonic
        {
          contract: dWOSonicProxy,
          signature: "upgradeTo(address)",
          args: [dWSonicImpl.address],
        },
        // 2. Run the second initializer
        {
          contract: cWOSonic,
          signature: "initialize2()",
          args: [],
        },
      ],
    };
  }
);
