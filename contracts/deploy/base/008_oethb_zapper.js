const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  { deployName: "008_oethb_zapper", forceDeploy: false },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cWOETHbProxy = await ethers.getContract("WOETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy new Zapper
    await deployWithConfirmation(
      "OETHBaseZapper",
      [cOETHbProxy.address, cWOETHbProxy.address, cOETHbVaultProxy.address],
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
