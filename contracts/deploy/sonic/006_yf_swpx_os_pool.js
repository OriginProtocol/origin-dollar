const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "006_yf_swpx_os_pool",
  },
  async ({ ethers }) => {
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);

    return {
      actions: [
        {
          // 1. Delegate the yield from the SwapX SWPx/OS pool to SwapX Treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            addresses.sonic.SwapXSWPxOSPool,
            addresses.sonic.SwapXTreasury,
          ],
        },
      ],
    };
  }
);
