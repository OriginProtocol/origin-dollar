const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "080_deploy_origin_lens",
    forceDeploy: true,
    deployerIsProposer: false,
  },
  async ({ deployWithConfirmation, withConfirmation, getTxOpts, ethers }) => {
    const { timelockAddr, strategistAddr, deployerAddr } =
      await getNamedAccounts();

    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    // Deployer Actions
    // ----------------

    // 1. Deploy OriginLensProxy and OriginLens
    await deployWithConfirmation("OriginLensProxy");
    const dOriginLens = await deployWithConfirmation("OriginLens", [
      addresses.mainnet.OETHProxy,
    ]);

    // 2. Initialize OriginLens
    const cOriginLensProxy = await ethers.getContract("OriginLensProxy");
    const cOriginLens = await ethers.getContractAt(
      "OriginLens",
      cOriginLensProxy.address
    );

    // Construct initialize call data to init and configure the new contract
    const initData = cOriginLens.interface.encodeFunctionData(
      "initialize(address,address[],uint8[])",
      [
        strategistAddr,
        [addresses.mainnet.ConvexOETHAMOStrategy, addresses.mainnet.BalancerRETHStrategyProxy],
        [1, 2]
      ]
    );

    // prettier-ignore
    await withConfirmation(
      cOriginLensProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOriginLens.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    )

    console.log("Origin Lens Deployed at:", cOriginLensProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Configure OriginLens",
      actions: [
        // {
        //   contract: cOriginLens,
        //   signature: "setStrategyKind(address,uint8)",
        //   args: [addresses.mainnet.ConvexOETHAMOStrategy, 1],
        // },
        // {
        //   contract: cOriginLens,
        //   signature: "setStrategyKind(address,uint8)",
        //   args: [addresses.mainnet.BalancerRETHStrategyProxy, 2],
        // },
      ],
    };
  }
);
