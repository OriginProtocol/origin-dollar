const { deployOnSonic } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "020_enable_buyback_operator",
  },
  async () => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    return {
      name: "Enable Buyback Operator",
      actions: [
        {
          contract: cOSonicVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.multichainBuybackOperator],
        },
      ],
    };
  }
);
