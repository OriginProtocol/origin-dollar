const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "004_base_amo_strategy",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    await deployWithConfirmation("AerodromeAMOStrategyProxy");
    await deployWithConfirmation("AerodromeAMOStrategy", [
      /* The pool address is not yet known. Might be created before we deploy the
       * strategy or after.
       */
      [addresses.zero, cOETHbVaultProxy.address], // platformAddress, VaultAddress
      addresses.base.WETH, // weth address
      cOETHbProxy.address  // OETHb address
    ]);

    const cAMOStrategyProxy = await ethers.getContract("AerodromeAMOStrategyProxy");
    const cAMOStrategy = await ethers.getContract("AerodromeAMOStrategy");

    console.log("Deployed AMO strategy and proxy contracts");

    // Init the AMO strategy
    const initData = cAMOStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[],address,address,address,address)",
      [
        [addresses.base.AERO], // rewardTokenAddresses
        [], // assets
        [], // pTokens
        addresses.base.universalSwapRouter, // swapRouter
        addresses.base.nonFungiblePositionManager, // nonfungiblePositionManager
        addresses.base.poolFactory, // clFactory
        addresses.base.sugarHelper  // sugarHelper
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cAMOStrategy.address,
          deployerAddr,
          initData
        )
    );
    console.log("Initialized cAMOStrategyProxy and implementation");

    // Transfer ownership
    await withConfirmation(
      cAMOStrategyProxy.connect(sDeployer).transferGovernance(governorAddr)
    );
    console.log("Transferred Governance");

    return {
      actions: [
        {
          // 1. Claim Governance on the AMO strategy
          contract: cAMOStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        }
      ],
    };
  }
);
