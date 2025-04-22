const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  {
    deployName: "028_treasury_boost",
  },
  async ({ ethers }) => {
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHb = await ethers.getContractAt("OETHBase", cOETHbProxy.address);

    return {
      actions: [
        {
          // Treasury boost
          // Curve Pool ION/OETH -> EOA
          contract: cOETHb,
          signature: "delegateYield(address,address)",
          args: [
            "0xf583c95c5f2d4245044a8c35b7890da649a7777f",
            "0x2273B2Fb1664f100C07CDAa25Afd1CD0DA3C7437",
          ],
        },
      ],
    };
  }
);