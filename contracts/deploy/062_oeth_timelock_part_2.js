const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "062_oeth_timelock_part_2" },
  async ({ ethers }) => {
    const cFraxETHStrategyProxy = await ethers.getContract(
      "FraxETHStrategyProxy"
    );
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cWOETHProxy = await ethers.getContract("WOETHProxy");
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );
    //addresses.mainnet.OldTimelock
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOldTimelock = await ethers.getContract("Governor");

    // Governance Actions
    // ----------------
    return {
      name: "Claim governance by the Old OUSD Timelock",
      actions: [
        {
          contract: cOldTimelock,
          signature: "setDelay(uint256)",
          args: [60 * 60 * 24], // 1 day
        },
        {
          contract: cOETHVaultProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cFraxETHStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cWOETHProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHDripperProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOETHHarvesterProxy,
          signature: "claimGovernance()",
          args: [],
        },
      ],
    };
  }
);
