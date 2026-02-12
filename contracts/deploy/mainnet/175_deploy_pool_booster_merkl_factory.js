const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "175_deploy_pool_booster_merkl_factory",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    const oethProxy = await ethers.getContract("OETHProxy");
    const oeth = await ethers.getContractAt("OETH", oethProxy.address);

    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );
    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // Get old factory from deployment artifacts
    const oldFactory = await ethers.getContract("PoolBoosterFactoryMerkl");

    // ---------------------------------------------------------------------------------------------------------
    // --- Deploy PoolBoosterMerklV2 (implementation for clones)
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterMerklV2 = await deployWithConfirmation(
      "PoolBoosterMerklV2",
      []
    );
    console.log(
      `PoolBoosterMerklV2 deployed to ${dPoolBoosterMerklV2.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // --- Deploy new PoolBoosterFactoryMerkl
    // ---------------------------------------------------------------------------------------------------------
    // skipUpgradeSafety: true — this is a fresh deploy, not an upgrade of the old factory
    const dPoolBoosterFactoryMerkl = await deployWithConfirmation(
      "PoolBoosterFactoryMerkl",
      [
        oeth.address,
        addresses.mainnet.Timelock,
        cPoolBoostCentralRegistryProxy.address,
        dPoolBoosterMerklV2.address,
      ],
      undefined,
      true
    );
    console.log(
      `New PoolBoosterFactoryMerkl deployed to ${dPoolBoosterFactoryMerkl.address}`
    );

    // Encode initData for the new Pool Booster clone
    const iPoolBoosterMerklV2 = new ethers.utils.Interface([
      "function initialize(uint32,uint32,address,address,address,address,bytes)",
    ]);
    const initData = iPoolBoosterMerklV2.encodeFunctionData("initialize", [
      604800, // duration: 7 days
      45, // campaignType: concentrated liquidity
      oeth.address, // rewardToken
      addresses.mainnet.CampaignCreator, // merklDistributor
      addresses.mainnet.Guardian, // governor
      addresses.multichainStrategist, // strategist
      "0x", // campaignData: placeholder
    ]);

    const cNewFactory = await ethers.getContractAt(
      "PoolBoosterFactoryMerkl",
      dPoolBoosterFactoryMerkl.address
    );

    return {
      name: "Swap PoolBoosterFactoryMerkl and create Pool Booster",
      actions: [
        {
          // Remove old factory from central registry
          contract: cPoolBoostCentralRegistry,
          signature: "removeFactory(address)",
          args: [oldFactory.address],
        },
        {
          // Approve new factory in central registry
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterFactoryMerkl.address],
        },
        {
          // Create a new Pool Booster via the new factory
          contract: cNewFactory,
          signature: "createPoolBoosterMerkl(address,bytes,uint256)",
          args: [
            "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb", // AMM pool
            initData,
            1, // salt
          ],
        },
      ],
    };
  }
);
