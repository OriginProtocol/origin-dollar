const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");

module.exports = deployOnBaseWithGuardian(
  { deployName: "008_oethb_zapper", forceDeploy: false },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy new Zapper
    await deployWithConfirmation(
      "OETHBaseZapper",
      [cOETHbProxy.address, cOETHbVaultProxy.address],
      undefined,
      true
    );

    // Governance Actions
    // ----------------
    return {
      actions: [],
    };
  }
);
