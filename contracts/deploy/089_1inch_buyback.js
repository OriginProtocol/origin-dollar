const addresses = require("../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "089_1inch_buyback",
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "19953986745691218316817489613719564552439805381746724170485904355958039770871",
  },
  async ({ ethers }) => {
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");

    const cSwapper = await ethers.getContract("Swapper1InchV5");

    // Deploy new OETHBuyback implementation
    const dOETHBuybackImpl = await deployWithConfirmation(
      "OETHBuyback",
      [
        addresses.mainnet.OETHProxy,
        addresses.mainnet.OGV,
        addresses.mainnet.CVX,
        addresses.mainnet.CVXLocker,
      ],
      undefined,
      true
    );

    // Deploy new OUSDBuyback implementation
    const dOUSDBuybackImpl = await deployWithConfirmation(
      "OUSDBuyback",
      [
        addresses.mainnet.OUSDProxy,
        addresses.mainnet.OGV,
        addresses.mainnet.CVX,
        addresses.mainnet.CVXLocker,
      ],
      undefined,
      true
    );

    const cOETHBuyback = await ethers.getContractAt(
      "OETHBuyback",
      cOETHBuybackProxy.address
    );
    const cOUSDBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      cOUSDBuybackProxy.address
    );

    await cSwapper.approveAssets([
      addresses.mainnet.OGV,
      addresses.mainnet.CVX,
      addresses.mainnet.OUSDProxy,
      addresses.mainnet.OETHProxy,
    ]);

    return {
      name: "Upgrade Buyback contracts to use 1inch",
      actions: [
        // 1. Upgrade OUSD Buyback to new implementation
        {
          contract: cOUSDBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDBuybackImpl.address],
        },
        // 2. Update swap router address on OUSD Buyback
        {
          contract: cOUSDBuyback,
          signature: "setSwapRouter(address)",
          args: [cSwapper.address],
        },
        // 3. Set splits for CVX
        {
          contract: cOUSDBuyback,
          signature: "setCVXShareBps(uint256)",
          args: [5000], // 50%
        },
        // 4. Compute buyback splits
        {
          contract: cOUSDBuyback,
          signature: "updateBuybackSplits()",
          args: [],
        },
        // 5. Upgrade OETH Buyback to new implementation
        {
          contract: cOETHBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dOETHBuybackImpl.address],
        },
        // 6. Update swap router address on OETH Buyback
        {
          contract: cOETHBuyback,
          signature: "setSwapRouter(address)",
          args: [cSwapper.address],
        },
        // 7. Set splits for CVX
        {
          contract: cOETHBuyback,
          signature: "setCVXShareBps(uint256)",
          args: [5000], // 50%
        },
        // 8. Compute buyback splits
        {
          contract: cOETHBuyback,
          signature: "updateBuybackSplits()",
          args: [],
        },
      ],
    };
  }
);
