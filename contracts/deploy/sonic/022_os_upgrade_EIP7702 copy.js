const { deployOnSonic } = require("../../utils/deploy-l2.js");
const { deployWithConfirmation } = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "022_os_upgrade_EIP7702 copy",
    forceSkip: false,
  },
  async ({ ethers }) => {
    // 1. Deploy new OS implementation
    const dOSonic = await deployWithConfirmation("OSonic");
    const cOSonicProxy = await ethers.getContract("OSonicProxy");

    console.log(`Deployed Origin S to ${dOSonic.address}`);
    console.log(`OSonic Proxy at ${cOSonicProxy.address}`);

    return {
      name: "Upgrade OS token contract",
      actions: [
        // 1. Upgrade the OSonic proxy to the new implementation
        {
          contract: cOSonicProxy,
          signature: "upgradeTo(address)",
          args: [dOSonic.address],
        },
      ],
    };
  }
);
