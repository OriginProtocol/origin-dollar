const { deployOnBase } = require("../../utils/deploy-l2.js");

module.exports = deployOnBase(
  {
    deployName: "032_vault_perf_fee",
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
          signature: "setTrusteeFeeBps(uint256)",
          args: [2000], // 20%
        },
      ],
    };
  }
);
