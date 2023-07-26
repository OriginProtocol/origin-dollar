const { deploymentWithGuardianGovernor } = require("../utils/deploy");

module.exports = deploymentWithGuardianGovernor(
  { deployName: "054_woeth" },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    const actions = await deployWOETH({
      deployWithConfirmation,
      withConfirmation,
      ethers,
    });

    // Governance Actions
    // ----------------
    return {
      name: "Deploy WOETH Token",
      actions,
    };
  }
);

const deployWOETH = async ({ deployWithConfirmation, ethers }) => {
  const cOETHProxy = await ethers.getContract("OETHProxy");
  const cWOETHProxy = await ethers.getContract("WOETHProxy");

  const dWOETHImpl = await deployWithConfirmation("WOETH", [
    cOETHProxy.address,
    "Wrapped OETH",
    "WOETH",
  ]);

  const cWOETH = await ethers.getContractAt("WOETH", cWOETHProxy.address);

  return [
    {
      contract: cWOETHProxy,
      signature: "upgradeTo(address)",
      args: [dWOETHImpl.address],
    },
    {
      contract: cWOETH,
      signature: "initialize()",
      args: [],
    },
  ];
};
