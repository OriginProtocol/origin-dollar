const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "080_upgrade_buyback",
    forceDeploy: true,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, ethers }) => {
    const { strategistAddr } = await getNamedAccounts();
    // Current contracts
    const cBuybackProxy = await ethers.getContract("BuybackProxy");
    const cOETHVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      addresses.mainnet.OETHVaultProxy
    );
    const cOUSD = await ethers.getContractAt(
      "OUSD",
      addresses.mainnet.OUSDProxy
    );

    // Old Buyback contract with OUSD
    const oldBuybackAddress1 = "0x77314EB392b2be47C014cde0706908b3307Ad6a9";
    const oldBuybackAddress2 = "0x6C5cdfB47150EFc52072cB93Eea1e0F123529748";
    const cOldBuyback1 = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      oldBuybackAddress1
    );
    const ousdBalance1 = await cOUSD.balanceOf(oldBuybackAddress1);
    const cOldBuyback2 = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      oldBuybackAddress2
    );
    const ousdBalance2 = await cOUSD.balanceOf(oldBuybackAddress2);

    // Deployer Actions
    // ----------------

    // 1. Deploy new implementation
    const dBuybackImpl = await deployWithConfirmation(
      "Buyback",
      [
        addresses.mainnet.OETHProxy,
        addresses.mainnet.OUSDProxy,
        addresses.mainnet.OGV,
        addresses.mainnet.USDT,
        addresses.mainnet.WETH,
        addresses.mainnet.CVX,
        addresses.mainnet.CVXLocker,
      ],
      undefined,
      true
    );
    const cBuyback = await ethers.getContractAt(
      "Buyback",
      cBuybackProxy.address
    );

    console.log("New Buyback implementation address: ", dBuybackImpl.address);

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Buyback contract",
      actions: [
        // 1. Upgrade to new implementation
        {
          contract: cBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dBuybackImpl.address],
        },
        // 2. Update universal router address
        {
          contract: cBuyback,
          signature: "setUniswapUniversalRouter(address)",
          args: [addresses.mainnet.uniswapUniversalRouter],
        },
        // 3. Reset allowance
        {
          contract: cBuyback,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        // 4. Have OETH use the buyback contract
        {
          contract: cOETHVaultAdmin,
          signature: "setTrusteeAddress(address)",
          args: [cBuybackProxy.address],
        },
        {
          // 5. Transfer left-over balance to Governor from old contract #1
          contract: cOldBuyback1,
          signature: "transferToken(address,uint256)",
          args: [cOUSD.address, ousdBalance1],
        },
        {
          // 6. Transfer left-over balance to Governor from old contract #2
          contract: cOldBuyback2,
          signature: "transferToken(address,uint256)",
          args: [cOUSD.address, ousdBalance2],
        },
        {
          // 7. Transfer OUSD balance from Governor to the Buyback contract
          contract: cOUSD,
          signature: "transfer(address,uint256)",
          args: [cBuybackProxy.address, ousdBalance1.add(ousdBalance2)],
        },
      ],
    };
  }
);
