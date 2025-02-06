const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "008_swapx_yield_forward",
  },
  async ({ ethers }) => {
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);

    return {
      actions: [
        {
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [addresses.sonic.SwapXOsUSDCePool, addresses.sonic.nodeDriver],
        },
      ],
    };
  }
);
