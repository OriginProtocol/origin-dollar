const { deploymentWithGuardianGovernor } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGuardianGovernor(
  { deployName: "061_oeth_timelock_part_1" },
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
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Transfer governance to the Old OUSD Timelock",
      actions: [
        {
          contract: cOETHVaultProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cFraxETHStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cOETHProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cWOETHProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cOETHDripperProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
        {
          contract: cOETHHarvesterProxy,
          signature: "transferGovernance(address)",
          args: [addresses.mainnet.OldTimelock],
        },
      ],
    };
  }
);
