const { deployOnPlume } = require("../../utils/deploy-l2");

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
        // setRebaseThreshold removed: rebaseThreshold deprecated and the
        // setter no longer exists on the vault. OETP is winding down.
      ],
    };
  }
);
