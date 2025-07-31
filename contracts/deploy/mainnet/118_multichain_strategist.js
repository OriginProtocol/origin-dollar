const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "118_multichain_strategist",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "29029286887383246507190904901480289164471194993284788972189545670391461770154",
  },
  async () => {
    const { multichainStrategistAddr } = await getNamedAccounts();

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    const cOUSDVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cOUSDVaultProxy.address
    );

    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOETHBuyback = await ethers.getContractAt(
      "OETHBuyback",
      cOETHBuybackProxy.address
    );

    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");
    const cOUSDBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      cOUSDBuybackProxy.address
    );

    const cOETHHarvesterSimple = await ethers.getContract(
      "OETHHarvesterSimple"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Switch to multichain guardian",
      actions: [
        {
          contract: cOETHVault,
          signature: "setStrategistAddr(address)",
          args: [multichainStrategistAddr],
        },
        {
          contract: cOUSDVault,
          signature: "setStrategistAddr(address)",
          args: [multichainStrategistAddr],
        },
        {
          contract: cOETHBuyback,
          signature: "setStrategistAddr(address)",
          args: [multichainStrategistAddr],
        },
        {
          contract: cOUSDBuyback,
          signature: "setStrategistAddr(address)",
          args: [multichainStrategistAddr],
        },
        {
          contract: cOETHHarvesterSimple,
          signature: "setStrategistAddr(address)",
          args: [multichainStrategistAddr],
        },
      ],
    };
  }
);
