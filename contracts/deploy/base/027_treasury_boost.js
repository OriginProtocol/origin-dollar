const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  {
    deployName: "027_treasury_boost",
  },
  async ({ ethers }) => {
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHb = await ethers.getContractAt("OETHBase", cOETHbProxy.address);

    console.log("cOETHbProxy", cOETHbProxy.address);
    console.log("cOETHb", cOETHb.address);
    return {
      actions: [
        {
          // Treasury boost
          // Curve Pool USDGLO/OETH -> Gnosis Safe
          contract: cOETHb,
          signature: "delegateYield(address,address)",
          args: [
            "0x22559fC36A9B0c936DfF0AB1d0DE9a2aC5e6A059",
            "0x31d2737adf35A6981546b4dA644eE64973Cd4Fd8",
          ],
        },
      ],
    };
  }
);
