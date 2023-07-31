const { deploymentWithGovernanceProposal } = require("./deploy");
const addresses = require("../utils/addresses");

module.exports = ({
  deploymentOpts,

  proxyContractName,

  platformAddress, // Address of the Balancer pool
  poolId, // Pool ID of the Balancer pool

  auraRewardsContractAddress,

  rewardTokenAddresses,
  assets,
}) => {
  return deploymentWithGovernanceProposal(
    deploymentOpts,
    async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
      const { deployerAddr } = await getNamedAccounts();
      const sDeployer = await ethers.provider.getSigner(deployerAddr);

      // Current contracts
      const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
      const cOETHVaultAdmin = await ethers.getContractAt(
        "OETHVaultAdmin",
        cOETHVaultProxy.address
      );

      // Deployer Actions
      // ----------------

      // 1. Deploy new proxy
      // New strategy will be living at a clean address
      const dOETHBalancerMetaPoolStrategyProxy = await deployWithConfirmation(
        proxyContractName
      );
      const cOETHBalancerMetaPoolStrategyProxy = await ethers.getContractAt(
        proxyContractName,
        dOETHBalancerMetaPoolStrategyProxy.address
      );

      // 2. Deploy new implementation
      const dOETHBalancerMetaPoolStrategyImpl = await deployWithConfirmation(
        "BalancerMetaPoolStrategy",
        [
          [platformAddress, cOETHVaultProxy.address],
          [
            addresses.mainnet.rETH,
            addresses.mainnet.stETH,
            addresses.mainnet.wstETH,
            addresses.mainnet.frxETH,
            addresses.mainnet.sfrxETH,
            addresses.mainnet.balancerVault, // Address of the Balancer vault
            poolId, // Pool ID of the Balancer pool
          ],
          auraRewardsContractAddress,
        ]
      );
      const cOETHBalancerMetaPoolStrategy = await ethers.getContractAt(
        "BalancerMetaPoolStrategy",
        dOETHBalancerMetaPoolStrategyProxy.address
      );

      const cOETHHarvesterProxy = await ethers.getContract(
        "OETHHarvesterProxy"
      );
      const cOETHHarvester = await ethers.getContractAt(
        "OETHHarvester",
        cOETHHarvesterProxy.address
      );

      // 3. Encode the init data
      const initFunction = "initialize(address[],address[],address[])";
      const initData =
        cOETHBalancerMetaPoolStrategy.interface.encodeFunctionData(
          initFunction,
          [rewardTokenAddresses, assets, [platformAddress, platformAddress]]
        );

      // 4. Init the proxy to point at the implementation
      // prettier-ignore
      await withConfirmation(
        cOETHBalancerMetaPoolStrategyProxy
          .connect(sDeployer)["initialize(address,address,bytes)"](
            dOETHBalancerMetaPoolStrategyImpl.address,
            addresses.mainnet.Timelock,
            initData,
            await getTxOpts()
          )
      );

      console.log(
        "Balancer strategy address:",
        dOETHBalancerMetaPoolStrategyProxy.address
      );

      // Governance Actions
      // ----------------
      return {
        name: "Deploy new Balancer MetaPool strategy",
        actions: [
          // 1. Add new strategy to the vault
          {
            contract: cOETHVaultAdmin,
            signature: "approveStrategy(address)",
            args: [cOETHBalancerMetaPoolStrategy.address],
          },
          // 2. Set supported strategy on Harvester
          {
            contract: cOETHHarvester,
            signature: "setSupportedStrategy(address,bool)",
            args: [cOETHBalancerMetaPoolStrategy.address, true],
          },
          // 3. Set harvester address
          {
            contract: cOETHBalancerMetaPoolStrategy,
            signature: "setHarvesterAddress(address)",
            args: [cOETHHarvesterProxy.address],
          },
        ],
      };
    }
  );
};
