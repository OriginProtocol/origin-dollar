const { deployOnSonic } = require("../../utils/deploy-l2");

module.exports = deployOnSonic(
  {
    deployName: "023_yf",
  },
  async ({ ethers }) => {
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);

    return {
      actions: [
        {
          // 1. Delegate the yield from the OS/RZR pool to Rezerve Treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x25163aff28810de41df601e7f1519000550386fd",
            "0x0e43df9f40cc6eed3ec70ea41d6f34329fe75986",
          ],
        },
      ],
    };
  }
);
