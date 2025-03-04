const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "010_swapx_yield_forward",
  },
  async ({ ethers }) => {
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);

    return {
      actions: [
        {
          // https://www.notion.so/originprotocol/TB-YieldForwarding-19a84d46f53c806f9fd3c0921f10d940?pvs=25
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            addresses.sonic.Shadow.OsEco.pool,
            addresses.sonic.Shadow.OsEco.yf_treasury,
          ],
        },
        {
          // https://www.notion.so/originprotocol/TB-YieldForwarding-19984d46f53c80f1a913cdb199432ecd
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            addresses.sonic.SwapX.OsHedgy.pool,
            addresses.sonic.SwapX.OsHedgy.yf_treasury,
          ],
        },
      ],
    };
  }
);
