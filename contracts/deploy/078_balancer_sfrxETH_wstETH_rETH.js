const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { balancer_wstETH_sfrxETH_rETH_PID } = require("../utils/constants");

const platformAddress = addresses.mainnet.wstETH_sfrxETH_rETH_BPT;

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "078_balancer_sfrxETH_wstETH_rETH",
    forceDeploy: false,
    //forceSkip: true,
    deployerIsProposer: true,
    //proposalId: ,
  },
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

    // 1. Deploy new proxy for the Balancer strategy
    // New strategy will be living at a clean address
    const dOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy =
      await deployWithConfirmation(
        "OETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy"
      );
    const cOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy =
      await ethers.getContractAt(
        "OETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy",
        dOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy.address
      );

    // 2. Deploy new Balancer strategy implementation
    const dOETHBalancerComposablePoolStrategyImpl =
      await deployWithConfirmation("BalancerComposablePoolStrategy", [
        [platformAddress, cOETHVaultProxy.address],
        [
          addresses.mainnet.rETH,
          addresses.mainnet.stETH,
          addresses.mainnet.wstETH,
          addresses.mainnet.frxETH,
          addresses.mainnet.sfrxETH,
          addresses.mainnet.balancerVault, // Address of the Balancer vault
          balancer_wstETH_sfrxETH_rETH_PID, // Pool ID of the Balancer pool
        ],
        addresses.mainnet.wstETH_sfrxETH_rETH_AuraRewards, // Address of the Aura rewards contract
        0, // position of BPT token within the sfrxETH-rETH-wstETH Balancer pool
      ]);
    const cOETHBalancerComposablePoolStrategy = await ethers.getContractAt(
      "BalancerComposablePoolStrategy",
      dOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy.address
    );

    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );

    // 3. Encode the init data
    const initFunction = "initialize(address[],address[],address[])";
    const initData =
      cOETHBalancerComposablePoolStrategy.interface.encodeFunctionData(
        initFunction,
        [
          [addresses.mainnet.BAL, addresses.mainnet.AURA],
          [
            addresses.mainnet.stETH,
            addresses.mainnet.frxETH,
            addresses.mainnet.rETH,
          ],
          [platformAddress, platformAddress, platformAddress],
        ]
      );

    // 4. Init the proxy to point at the implementation
    // prettier-ignore
    await withConfirmation(
      cOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHBalancerComposablePoolStrategyImpl.address,
          addresses.mainnet.Timelock,
          initData,
          await getTxOpts()
        )
    );

    console.log(
      "Balancer strategy address:",
      dOETHBalancerCompPoolSfrxEthWstETHrETHStrategyProxy.address
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
          args: [cOETHBalancerComposablePoolStrategy.address],
        },
        // 2. Set supported strategy on Harvester
        {
          contract: cOETHHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cOETHBalancerComposablePoolStrategy.address, true],
        },
        // 3. Set harvester address
        {
          contract: cOETHBalancerComposablePoolStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterProxy.address],
        },
      ],
    };
  }
);
