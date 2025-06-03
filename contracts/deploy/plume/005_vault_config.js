const { deployOnPlume } = require("../../utils/deploy-l2");
const { parseUnits } = require("ethers/lib/utils.js");

module.exports = deployOnPlume(
  {
    deployName: "005_vault_config",
  },
  async () => {
    const { strategistAddr } = await getNamedAccounts();

    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");
    const cOETHpVault = await ethers.getContractAt(
      "IVault",
      cOETHpVaultProxy.address
    );

    return {
      actions: [
        {
          // Send performance fee to guardian
          contract: cOETHpVault,
          signature: "setTrusteeAddress(address)",
          args: [strategistAddr],
        },
        {
          // Set performance fee to 20%
          contract: cOETHpVault,
          signature: "setTrusteeFeeBps(uint256)",
          args: [2000], // 20%
        },
        {
          // Set rebase threshold
          contract: cOETHpVault,
          signature: "setRebaseThreshold(uint256)",
          args: [parseUnits("1", 18)], // 1 OETHp
        },
      ],
    };
  }
);
