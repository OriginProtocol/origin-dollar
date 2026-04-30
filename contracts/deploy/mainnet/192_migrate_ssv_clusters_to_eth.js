const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { getClusterInfo, splitOperatorIds } = require("../../utils/ssv");

// ETH Payment estimator for SSV Clusters
// https://ssv-eth-forecasting.vercel.app/

const strategyConfigs = [
  {
    proxyName: "NativeStakingSSVStrategy2Proxy",
    contractName: "NativeStakingSSVStrategy",
    operatorids: "752,753,754,755",
    // Another 63 validators will be migrated early May
    // The remaining validators can be consolidated at the end of May
    // 40 days with current number of validators should be more than enough
    ethValue: 0.2498,
  },
  {
    proxyName: "NativeStakingSSVStrategy3Proxy",
    contractName: "NativeStakingSSVStrategy",
    operatorids: "338,339,340,341",
    // No ETH as this cluster no longer has any validators
    // Need to upgrade to claim the SSV left in the cluster
    ethValue: 0,
  },
  {
    proxyName: "CompoundingStakingSSVStrategyProxy",
    contractName: "CompoundingStakingSSVStrategy",
    operatorids: "2070,2071,2072,2073",
    // This gives 90 days operations with the current validator balances.
    ethValue: 0.597136,
  },
];

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "192_migrate_ssv_clusters_to_eth",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const { chainId } = await ethers.provider.getNetwork();
    const actions = [];

    for (const strategyConfig of strategyConfigs) {
      const proxy = await ethers.getContract(strategyConfig.proxyName);
      const strategy = await ethers.getContractAt(
        strategyConfig.contractName,
        proxy.address
      );
      const operatorIds = splitOperatorIds(strategyConfig.operatorids);
      const { cluster } = await getClusterInfo({
        chainId,
        operatorids: operatorIds.join(","),
        ownerAddress: strategy.address,
      });
      const ethValue = strategyConfig.ethValue
        ? ethers.utils.parseEther(strategyConfig.ethValue.toString())
        : 0;

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
