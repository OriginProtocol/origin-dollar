const {
  deploymentWithGovernanceProposal,
  withConfirmation,
} = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "080_upgrade_buyback",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: false,
    proposalId:
      "106657143654146782218499766782185241541410736110675785019130125273133364011619",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cOUSDBuybackProxy = await ethers.getContract("BuybackProxy");
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

    // 1. Deploy new implementation for OUSD
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
    const cOUSDBuyback = await ethers.getContractAt(
      "OUSDBuyback",
      cOUSDBuybackProxy.address
    );

    console.log(
      "New OUSDBuyback implementation address: ",
      dOUSDBuybackImpl.address
    );

    // 2. Deploy new proxy and implementation for OETH
    const dOETHBuybackProxy = await deployWithConfirmation("OETHBuybackProxy");
    console.log(
      "Deployed OETHBuybackProxy address: ",
      dOETHBuybackProxy.address
    );
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
    console.log(
      "Deployed OETHBuyback implementation address: ",
      dOETHBuybackImpl.address
    );
    const cOETHBuybackProxy = await ethers.getContract("OETHBuybackProxy");
    const cOETHBuyback = await ethers.getContractAt(
      "OETHBuyback",
      cOETHBuybackProxy.address
    );

    // 3. Prepare implementation intialization data
    const initData = cOETHBuyback.interface.encodeFunctionData(
      "initialize(address,address,address,address)",
      [
        addresses.mainnet.uniswapUniversalRouter,
        strategistAddr,
        strategistAddr,
        addresses.mainnet.RewardsSource,
      ]
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cOETHBuybackProxy.connect(sDeployer)[initFunction](
        dOETHBuybackImpl.address,
        addresses.mainnet.Timelock, // Governor
        initData, // data for delegate call to the initialize function on the implementation
        await getTxOpts()
      )
    );
    console.log("Initialized OETHBuyback proxy and implementation");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Buyback contract",
      actions: [
        // 1. Upgrade OUSD Buyback to new implementation
        {
          contract: cOUSDBuybackProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDBuybackImpl.address],
        },
        // 2. Update universal router address on OUSD Buyback
        {
          contract: cOUSDBuyback,
          signature: "setUniswapUniversalRouter(address)",
          args: [addresses.mainnet.uniswapUniversalRouter],
        },
        // 3. Reset allowance for OUSD Buyback
        {
          contract: cOUSDBuyback,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        // 4. Have OETH use the buyback contract
        {
          contract: cOETHVaultAdmin,
          signature: "setTrusteeAddress(address)",
          args: [cOETHBuybackProxy.address],
        },
        // 5. Reset allowance for OETH Buyback
        {
          contract: cOETHBuyback,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        // 6. Transfer left-over balance to Governor from old contract #1
        {
          contract: cOldBuyback1,
          signature: "transferToken(address,uint256)",
          args: [cOUSD.address, ousdBalance1],
        },
        // 7. Transfer left-over balance to Governor from old contract #2
        {
          contract: cOldBuyback2,
          signature: "transferToken(address,uint256)",
          args: [cOUSD.address, ousdBalance2],
        },
        // 8. Transfer OUSD balance from Governor to the Buyback contract
        {
          contract: cOUSD,
          signature: "transfer(address,uint256)",
          args: [cOUSDBuybackProxy.address, ousdBalance1.add(ousdBalance2)],
        },
      ],
    };
  }
);
