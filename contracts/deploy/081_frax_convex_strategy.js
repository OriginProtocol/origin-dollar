const addresses = require("../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "081_frax_convex_strategy",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
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
    const dFraxConvexWethStrategyProxy = await deployWithConfirmation(
      "FraxConvexWethStrategyProxy"
    );
    const cFraxConvexWethStrategyProxy = await ethers.getContract(
      "FraxConvexWethStrategyProxy"
    );

    // 2. Deploy strategy implementation
    const dFraxConvexStrategy = await deployWithConfirmation(
      "FraxConvexStrategy",
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
          addresses.mainnet.FraxStakedConvexWeth,
          // locked stkcvxfrxeth-ng-f-frax
          addresses.mainnet.LockedFraxStakedConvexWeth,
        ],
      ]
    );
    const cFraxConvexStrategy = await ethers.getContractAt(
      "FraxConvexStrategy",
      dFraxConvexWethStrategyProxy.address
    );

    // 3. Initialize the new Curve frxETH/WETH strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cFraxConvexStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX, addresses.mainnet.FXS],
        [addresses.mainnet.WETH, addresses.mainnet.frxETH],
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.CurveFrxEthWethPool,
        ],
      ]
    );
    console.log("About to initialize Frax Convex frxETH/WETH Strategy");

    // prettier-ignore
    await withConfirmation(
      cFraxConvexWethStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dFraxConvexStrategy.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    );
    console.log("Initialized Frax Convex frxETH/WETH Strategy");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Frax Convex frxETH/WETH Strategy.",
      actions: [
        // 1. Approve the new strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cFraxConvexStrategy.address],
        },
        // 2. Add the new strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cFraxConvexStrategy.address, true],
        },
        // 3. Set the harvester address on the new strategy
        {
          contract: cFraxConvexStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
        // TODO add Harvest of FXS
      ],
    };
  }
);
