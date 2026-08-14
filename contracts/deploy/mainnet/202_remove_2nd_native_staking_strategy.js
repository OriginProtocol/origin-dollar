const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { getClusterInfo, splitOperatorIds } = require("../../utils/ssv");

const nativeStakingStrategy2OperatorIds = "752,753,754,755";

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "202_remove_2nd_native_staking_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const { chainId } = await ethers.provider.getNetwork();

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );
    const cNativeStakingStrategy2Proxy = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    const cNativeStakingStrategy2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategy2Proxy.address
    );
    const cCompoundingStakingStrategyProxy = await ethers.getContract(
      "CompoundingStakingStrategyProxy"
    );
    const cCompoundingStakingStrategy = await ethers.getContractAt(
      "CompoundingStakingStrategy",
      cCompoundingStakingStrategyProxy.address
    );

    const nativeStakingStrategy2OperatorIdsArray = splitOperatorIds(
      nativeStakingStrategy2OperatorIds
    );
    const { cluster: nativeStakingStrategy2Cluster } = await getClusterInfo({
      chainId,
      operatorids: nativeStakingStrategy2OperatorIdsArray.join(","),
      ownerAddress: cNativeStakingStrategy2.address,
    });
    const nativeStakingStrategy2ClusterEthBalance = ethers.BigNumber.from(
      nativeStakingStrategy2Cluster.balance
    );

    console.log(
      `Withdrawing ${ethers.utils.formatEther(
        nativeStakingStrategy2ClusterEthBalance
      )} ETH from the 2nd Native Staking Strategy SSV cluster`
    );

    return {
      name: "Withdraw SSV cluster ETH, remove the 2nd Native Staking Strategy and update the Compounding Staking Strategy registrator",
      actions: [
        {
          contract: cNativeStakingStrategy2,
          signature:
            "withdrawSsvClusterEth(uint64[],uint256,(uint32,uint64,uint64,bool,uint256))",
          args: [
            nativeStakingStrategy2OperatorIdsArray,
            nativeStakingStrategy2ClusterEthBalance,
            nativeStakingStrategy2Cluster,
          ],
        },
        {
          contract: cOETHVault,
          signature: "removeStrategy(address)",
          args: [cNativeStakingStrategy2Proxy.address],
        },
        {
          contract: cCompoundingStakingStrategy,
          signature: "setRegistrator(address)",
          args: [addresses.mainnet.talosRelayer],
        },
      ],
    };
  }
);
