const { deployOnBase } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "031_enable_buyback_operator",
  },
  async () => {
    const cOETHBaseVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHBaseVault = await ethers.getContractAt(
      "IVault",
      cOETHBaseVaultProxy.address
    );

    return {
      name: "Enable Buyback Operator",
      actions: [
        {
          contract: cOETHBaseVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.multichainBuybackOperator],
        },
      ],
    };
  }
);
