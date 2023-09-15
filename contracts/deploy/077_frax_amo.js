const addresses = require("../utils/addresses");
const { frxEthPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "077_frax_amo",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cVault = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.VaultProxy
    );
    const cHarvester = await ethers.getContractAt(
      "Harvester",
      addresses.mainnet.HarvesterProxy
    );

    // Deploy the new proxy
    const dConvexFrxETHAMOStrategyProxy = await deployWithConfirmation(
      "ConvexFrxETHAMOStrategyProxy"
    );
    const cConvexFrxETHAMOStrategyProxy = await ethers.getContract(
      "ConvexFrxETHAMOStrategyProxy"
    );

    // Deploy and set the immutable variables
    const dConvexFrxETHAMOStrategy = await deployWithConfirmation(
      "ConvexFrxETHAMOStrategy",
      [
        [
          addresses.mainnet.CurveFrxETHOETHPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          addresses.mainnet.OETHProxy, // oTokenAddress (OETH),
          addresses.mainnet.frxETH, // assetAddress (frxETH)
          1, // Curve pool index for OToken OETH
          0, // Curve pool index for asset frxETH
        ],
        [
          addresses.mainnet.CVXBooster, // cvxDepositorAddress,
          addresses.mainnet.CVXFrxETHRewardsPool, // cvxRewardStakerAddress,
          frxEthPoolLpPID, // cvxDepositorPTokenId
        ],
      ]
    );

    const cConvexFrxETHAMOStrategy = await ethers.getContractAt(
      "ConvexFrxETHAMOStrategy",
      dConvexFrxETHAMOStrategyProxy.address
    );

    // Construct initialize call data to init and configure the new strategy
    const initData = cConvexFrxETHAMOStrategy.interface.encodeFunctionData(
      "initialize(address[])",
      [[addresses.mainnet.CRV, addresses.mainnet.CVX]]
    );

    // prettier-ignore
    await withConfirmation(
        cConvexFrxETHAMOStrategyProxy
              .connect(sDeployer)["initialize(address,address,bytes)"](
                dConvexFrxETHAMOStrategy.address,
                timelockAddr,
                initData,
                await getTxOpts()
              )
          );
    console.log("Initialized FluxStrategy");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy AMO strategy for Curve frxETH/OETH pool.",
      actions: [
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cConvexFrxETHAMOStrategy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexFrxETHAMOStrategy.address, true],
        },
        {
          contract: cConvexFrxETHAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
