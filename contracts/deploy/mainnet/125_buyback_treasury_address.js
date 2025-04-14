const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "125_buyback_treasury_address",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId:
      "56651372254281448265344353866131308080772476253698569576053764086501989665213",
  },
  async () => {
    const cBuybackProxy = await ethers.getContract("BuybackProxy");
    const cBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      cBuybackProxy.address
    );
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOETHBuyback = await ethers.getContractAt(
      "OETHBuyback",
      cOETHBuybackProxy.address
    );

    return {
      name: "Update Treasury Address in OUSD & OETH Buyback contracts",
      actions: [
        {
          contract: cBuyback,
          signature: "setTreasuryManager(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cOETHBuyback,
          signature: "setTreasuryManager(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
