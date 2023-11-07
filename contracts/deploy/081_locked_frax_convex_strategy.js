const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "081_locked_frax_convex_strategy",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, getTxOpts, withConfirmation }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current OETH Vault contracts
    const cVault = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.OETHVaultProxy
    );
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      addresses.mainnet.OETHHarvesterProxy
    );

    // 1. Deploy strategy proxy
    const dConvexFrxEthWethStrategyProxy = await deployWithConfirmation(
      "LockedFraxConvexStrategyProxy"
    );
    const cConvexFrxEthWethStrategyProxy = await ethers.getContract(
      "LockedFraxConvexStrategyProxy"
    );

    // 2. Deploy strategy implementation
    const dLockedFraxConvexStrategy = await deployWithConfirmation(
      "LockedFraxConvexStrategy",
      [
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          2, //assets in the Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve pool
          addresses.mainnet.CurveFrxEthWethPool, // Curve LP token
        ],
        [
          // stkcvxfrxeth-ng-f-frax
          addresses.mainnet.FraxStakedConvexWrapperFrxEthWeth,
          // locked stkcvxfrxeth-ng-f-frax
          addresses.mainnet.LockedFraxStakedConvexFrxEthWeth,
        ],
      ]
    );
    const cLockedFraxConvexStrategy = await ethers.getContractAt(
      "LockedFraxConvexStrategy",
      dConvexFrxEthWethStrategyProxy.address
    );

    // 3. Initialize the new Curve frxETH/WETH strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cLockedFraxConvexStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX],
        [addresses.mainnet.WETH, addresses.mainnet.frxETH],
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.CurveFrxEthWethPool,
        ],
      ]
    );
    console.log("About to initialize locked Frax Convex frxETH/WETH Strategy");

    // prettier-ignore
    await withConfirmation(
      cConvexFrxEthWethStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dLockedFraxConvexStrategy.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized locked Frax Convex frxETH/WETH Strategy");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new locked Frax Convex frxETH/WETH Strategy.",
      actions: [
        // 1. Approve the new strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cLockedFraxConvexStrategy.address],
        },
        // 2. Add the new strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cLockedFraxConvexStrategy.address, true],
        },
        // 3. Set the harvester address on the new strategy
        {
          contract: cLockedFraxConvexStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
