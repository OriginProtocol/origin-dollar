const addresses = require("../utils/addresses");
const { frxEthWethPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "076_convex_frax_strategy",
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
    const dConvexTwoAssetStrategyProxy = await deployWithConfirmation(
      "ConvexTwoAssetStrategyProxy"
    );
    const cConvexTwoAssetStrategyProxy = await ethers.getContract(
      "ConvexTwoAssetStrategyProxy"
    );

    // 2. Deploy and set the immutable variables
    const dConvexTwoAssetStrategy = await deployWithConfirmation(
      "ConvexTwoAssetStrategy",
      [
        [
          addresses.mainnet.CurveFrxEthWethPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          addresses.mainnet.CVXBooster,
          addresses.mainnet.ConvexFrxEthWethRewardsPool,
          frxEthWethPoolLpPID,
        ],
      ]
    );
    const cConvexTwoAssetStrategy = await ethers.getContractAt(
      "ConvexTwoAssetStrategy",
      dConvexTwoAssetStrategyProxy.address
    );

    // 3. Initialize the new Curve frxETH/WETH strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cConvexTwoAssetStrategy.interface.encodeFunctionData(
      "initialize(address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX],
        [addresses.mainnet.WETH, addresses.mainnet.frxETH],
      ]
    );
    console.log("About to initialize Curve frxETH/WETH Strategy");

    // prettier-ignore
    await withConfirmation(
        cConvexTwoAssetStrategyProxy
                .connect(sDeployer)["initialize(address,address,bytes)"](
                  dConvexTwoAssetStrategy.address,
                  timelockAddr,
                  initData,
                  await getTxOpts()
                )
            );
    console.log("Initialized Curve frxETH/WETH Strategy");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Convex frxETH/WETH Strategy.",
      actions: [
        // 1. Approve the new Curve frxETH/WETH strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cConvexTwoAssetStrategy.address],
        },
        // 2. Add the new Curve frxETH/WETH strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexTwoAssetStrategy.address, true],
        },
        // 3. Set the harvester address on the new Curve frxETH/WETH strategy
        {
          contract: cConvexTwoAssetStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
