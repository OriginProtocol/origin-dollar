const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { getClusterInfo, splitOperatorIds } = require("../../utils/ssv");

const strategyConfigs = [
  {
    proxyName: "NativeStakingSSVStrategy2Proxy",
    contractName: "NativeStakingSSVStrategy",
    operatorids: "752,753,754,755",
  },
  {
    proxyName: "NativeStakingSSVStrategy3Proxy",
    contractName: "NativeStakingSSVStrategy",
    operatorids: "338,339,340,341",
  },
  {
    proxyName: "CompoundingStakingSSVStrategyProxy",
    contractName: "CompoundingStakingSSVStrategy",
    operatorids: "2070,2071,2072,2073",
  },
];

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "183_migrate_ssv_clusters_to_eth",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const ethValue = ethers.utils.parseEther("1");
    const actions = [];

    for (const strategyConfig of strategyConfigs) {
      const proxy = await ethers.getContract(strategyConfig.proxyName);
      const strategy = await ethers.getContractAt(
        strategyConfig.contractName,
        proxy.address
      );
      const operatorIds = splitOperatorIds(strategyConfig.operatorids);
      const { cluster } = await getClusterInfo({
        operatorids: operatorIds.join(","),
        ownerAddress: strategy.address,
      });

      actions.push({
        contract: strategy,
        signature:
          "migrateClusterToETH(uint64[],(uint32,uint64,uint64,bool,uint256))",
        args: [operatorIds, cluster],
        value: ethValue,
      });
    }

    return {
      name: "Migrate SSV clusters to ETH billing for OETH staking strategies",
      actions,
    };
  }
);
