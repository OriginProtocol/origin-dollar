const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "114_pool_booster_curve",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    console.log(`Using deployer account: ${deployerAddr}`);
    // 1. Deploy proxy
    const dCurvePoolBoosterProxy = await deployWithConfirmation(
      "CurvePoolBoosterProxy"
    );
    const cCurvePoolBoosterProxy = await ethers.getContract(
      "CurvePoolBoosterProxy"
    );

    // 2. Deploy implementation
    const dCurvePoolBoosterImpl = await deployWithConfirmation(
      "CurvePoolBooster",
      [
        42161, // Arbitrum chain id
        addresses.mainnet.CampaignRemoteManager, // Campaign Remote Manager (VotemarketV2 entry point)
        addresses.mainnet.OETHProxy, // To be modified with desired bribe token
        addresses.mainnet.CurveOETHGauge, // To be modified with desired gauge
      ]
    );
    console.log("dCurvePoolBoosterImpl: ", dCurvePoolBoosterImpl.address);
    const cCurvePoolBooster = await ethers.getContractAt(
      "CurvePoolBooster",
      dCurvePoolBoosterProxy.address
    );

    // 3. Initialize
    const initData = cCurvePoolBooster.interface.encodeFunctionData(
      "initialize(address,uint16,address)",
      [deployerAddr, 0, deployerAddr]
    );

    // 4. Initialize proxy
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cCurvePoolBoosterProxy.connect(sDeployer)[initFunction](
        dCurvePoolBoosterImpl.address,
        addresses.mainnet.Timelock, // governor
        initData // data for delegate call to the initialize function on the strategy
      )
    );

    return {};
  }
);
