const addresses = require("../utils/addresses");
const { frxEthWethPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "078_convex_frax_strategy",
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
      "ConvexFrxEthWethStrategyProxy"
    );
    const cConvexFrxEthWethStrategyProxy = await ethers.getContract(
      "ConvexFrxEthWethStrategyProxy"
    );

    // 2. Deploy linking to the library and set the immutable variables
    const dConvexFrxEthWethStrategy = await deployWithConfirmation(
      "ConvexTwoPoolStrategy",
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
        [addresses.mainnet.CVXBooster, frxEthWethPoolLpPID],
      ]
    );
    const cConvexFrxEthWethStrategy = await ethers.getContractAt(
      "ConvexTwoPoolStrategy",
      dConvexFrxEthWethStrategyProxy.address
    );

    // 3. Initialize the new Curve frxETH/WETH strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cConvexFrxEthWethStrategy.interface.encodeFunctionData(
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
    console.log("About to initialize Curve frxETH/WETH Strategy");

    // prettier-ignore
    await withConfirmation(
      cConvexFrxEthWethStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dConvexFrxEthWethStrategy.address,
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
          args: [cConvexFrxEthWethStrategy.address],
        },
        // 2. Add the new Curve frxETH/WETH strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexFrxEthWethStrategy.address, true],
        },
        // 3. Set the harvester address on the new Curve frxETH/WETH strategy
        {
          contract: cConvexFrxEthWethStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
