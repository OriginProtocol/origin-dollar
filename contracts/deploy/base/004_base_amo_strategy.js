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
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    await deployWithConfirmation("AerodromeAMOStrategyProxy");
    await deployWithConfirmation("AerodromeAMOStrategy", [
      /* The pool address is not yet known. Might be created before we deploy the
       * strategy or after.
       */
      [addresses.zero, cOETHbVaultProxy.address], // platformAddress, VaultAddress
      addresses.base.WETH, // weth address
      cOETHbProxy.address,  // OETHb address
      addresses.base.swapRouter, // swapRouter
      addresses.base.nonFungiblePositionManager, // nonfungiblePositionManager
      addresses.base.aerodromeOETHbWETHClPool, // clOETHbWethPool
      addresses.base.sugarHelper  // sugarHelper
    ]);

    const cAMOStrategyProxy = await ethers.getContract("AerodromeAMOStrategyProxy");
    const cAMOStrategyImpl = await ethers.getContract("AerodromeAMOStrategy");
    const cAMOStrategy = await ethers.getContractAt("AerodromeAMOStrategy", cAMOStrategyProxy.address);

    console.log("Deployed AMO strategy and proxy contracts");

    // Init the AMO strategy
    const initData = cAMOStrategyImpl.interface.encodeFunctionData(
      "initialize(address[],address[],address[],address)",
      [
        [addresses.base.AERO], // rewardTokenAddresses
        [], // assets
        [], // pTokens
        addresses.zero, // clOETHbWethGauge
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cAMOStrategyImpl.address,
          deployerAddr,
          initData
        )
    );
    console.log("Initialized cAMOStrategyProxy and implementation");

    await withConfirmation(
      cAMOStrategy
        .connect(sDeployer)
        .setPoolWethShare(2000) // 20%
    );

    await withConfirmation(
      cAMOStrategy
        .connect(sDeployer)
        .setWithdrawLiquidityShare(9900) // 99%
    );

    await withConfirmation(
      cAMOStrategy
        .connect(sDeployer)
        .setPoolWethShareVarianceAllowed(200) // 2%
    );

    await withConfirmation(
      cAMOStrategy
        .connect(sDeployer)
        .safeApproveAllTokens()
    );

    console.log("AMOStrategy configured");

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
        },
        {
          // 2. Approve the AMO strategy on the Vault
          contract: cOETHbVault,
          signature: "approveStrategy(address)",
          args: [cAMOStrategyProxy.address],
        },
        {
          // 3. Set strategist address
          contract: cOETHbVault,
          signature: "setStrategistAddr(address)",
          args: [addresses.base.strategist],
        },
        {
          // 4. Set strategy as whitelisted one to mint OETHb tokens
          contract: cOETHbVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cAMOStrategyProxy.address],
        }
      ],
    };
  }
);
