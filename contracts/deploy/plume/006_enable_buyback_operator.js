const { deployOnPlume } = require("../../utils/deploy-l2.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "006_enable_buyback_operator",
  },
  async () => {
    const cOETHPlumeVaultProxy = await ethers.getContract(
      "OETHPlumeVaultProxy"
    );
    const cOETHPlumeVault = await ethers.getContractAt(
      "IVault",
      cOETHPlumeVaultProxy.address
    );

    return {
      name: "Enable Buyback Operator",
      actions: [
        {
          contract: cOETHPlumeVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.multichainBuybackOperator],
        },
      ],
    };
  }
);
