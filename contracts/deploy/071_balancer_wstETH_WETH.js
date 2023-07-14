const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { BigNumber } = require("ethers");
const { balancerWstEthWethPID } = require("../utils/constants");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "071_balancer_wstETH_WETH",
    forceDeploy: false,
    deployerIsProposer: true,
    //proposalId: ,
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cOETHVaultProxy.address
    );
    const cOETHVault = await ethers.getContractAt("OETHVault", cOETHVaultProxy.address);

    // Deployer Actions
    // ----------------

    // 1. Deploy new proxy
    // New strategy will be living at a clean address
    const dOETHBalancerMetaPoolStrategyProxy = await deployWithConfirmation(
      "OETHBalancerMetaPoolStrategyProxy"
    );
    const cOETHBalancerMetaPoolStrategyProxy = await ethers.getContractAt(
      "OETHBalancerMetaPoolStrategyProxy",
      dOETHBalancerMetaPoolStrategyProxy.address
    );

    // 2. Deploy new implementation
    const dOETHBalancerMetaPoolStrategyImpl = await deployWithConfirmation(
      "BalancerMetaPoolStrategy"
    );
    const cOETHBalancerMetaPoolStrategy = await ethers.getContractAt(
      "BalancerMetaPoolStrategy",
      dOETHBalancerMetaPoolStrategyProxy.address
    );

    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );

    // 3. Init the proxy to point at the implementation
    await withConfirmation(
      cOETHBalancerMetaPoolStrategyProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dOETHBalancerMetaPoolStrategyImpl.address,
          sDeployer.address,
          [],
          await getTxOpts()
        )
    );

    // 4. Init and configure new Convex OUSD Meta strategy
    const initFunction =
      "initialize(address[],address[],address[],(address,address,address,address,uint256,bytes32))";
    await withConfirmation(
      cOETHBalancerMetaPoolStrategy.connect(sDeployer)[initFunction](
        [addresses.mainnet.BAL, addresses.mainnet.AURA],
        [addresses.mainnet.stETH, addresses.mainnet.WETH],
        [
          addresses.mainnet.wstETH_WETH_BPT,
          addresses.mainnet.wstETH_WETH_BPT
        ],
        [
          addresses.mainnet.wstETH_WETH_BPT,
          cOETHVaultProxy.address,
          addresses.mainnet.aureDepositor, // auraDepositorAddress,
          addresses.mainnet.CurveOUSDMetaPool, // auraRewardStakerAddress
          balancerWstEthWethPID, // auraDepositorPTokenId
          "0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080"
        ],
        await getTxOpts()
      )
    );

    console.log("INIT DONE");

    await withConfirmation(
      cOETHBalancerMetaPoolStrategy
        .connect(sDeployer)
        .transferGovernance(addresses.mainnet.Timelock, await getTxOpts())
    );

    console.log(
      "BALANCER STRATEGY ADDRESS",
      dOETHBalancerMetaPoolStrategyProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new Balancer MetaPool strategy",
      actions: [
        // 1. Accept governance of the new strategy
        {
          contract: cOETHBalancerMetaPoolStrategy,
          signature: "claimGovernance()",
          args: [],
        },
        // 2. Add new strategy to the vault
        {
          contract: cOETHVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cOETHBalancerMetaPoolStrategy.address],
        },
        // 3. Set OUSD meta strategy on Vault Admin contract
        {
          contract: cOETHVaultAdmin,
          signature: "setOusdMetaStrategy(address)",
          args: [cOETHBalancerMetaPoolStrategy.address],
        },
        // 4. Set supported strategy on Harvester
        {
          contract: cOETHHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cOETHBalancerMetaPoolStrategy.address, true],
        },
        // 5. Set harvester address
        {
          contract: cOETHBalancerMetaPoolStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterProxy.address],
        },
      ],
    };
  }
);
