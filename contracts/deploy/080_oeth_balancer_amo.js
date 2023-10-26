const { parseUnits } = require("ethers/lib/utils");
const addresses = require("../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "080_oeth_balancer_amo",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation, getTxOpts }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are changing the Strategy struct
    // TODO re-deploying Vault might not be required at the time of the actual deploy
    const dVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [],
      null,
      true
    );

    // 1. get Contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
    const cVaultAdmin = await ethers.getContractAt("OETHVaultAdmin", cVaultProxy.address);

    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );

    // 2. deploy new strategy proxy
    const dBalancerEthAMOStrategyProxy = await deployWithConfirmation(
      "BalancerEthAMOStrategyProxy"
    );
    const cBalancerEthAMOStrategyProxy = await ethers.getContract(
      "BalancerEthAMOStrategyProxy"
    );

    // 3. Deploy implementation and set the immutable variables
    const dBalancerEthAMOStrategy = await deployWithConfirmation(
      "BalancerEthAMOStrategy",
      [
        // TODO change platformAddress to balancer pool address
        [addresses.mainnet.rETH_WETH_AuraRewards, cVaultProxy.address], // BaseStrategyConfig[platformAddress, vaultAddress]
        [ // AMOConfig[oTokenAddress, assetAddress(other asset paired), oTokenCoinIndex, assetCoinIndex]
          addresses.mainnet.OETHProxy,
          addresses.mainnet.WETH,
          0, // TODO update
          1 // TODO update
        ],
        [ // BalancerConfig[balancerVault, balancerPoolId, auraRewardPool]
          addresses.mainnet.balancerVault,
          balancer_rETH_WETH_PID, // TODO change
          addresses.mainnet.rETH_WETH_AuraRewards // TODO change
        ]
      ]
    );

    const cBalancerEthAMOStrategy = await ethers.getContractAt(
      "BalancerEthAMOStrategy",
      dBalancerEthAMOStrategyProxy.address
    );

    // 3. Encode the init data initialize it with the initialization of the proxy
    const initData = cBalancerEthAMOStrategy.interface.encodeFunctionData(
      "initialize(address[])", // [_rewardTokenAddresses]
      [
        [addresses.mainnet.rETH, addresses.mainnet.WETH]
      ]
    );

    // 4. Init the proxy to point to the implementation
    // prettier-ignore
    await withConfirmation(
      cBalancerEthAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dBalancerEthAMOStrategy.address,
          timelockAddr,
          initData,
          await getTxOpts()
        )
    );

    console.log(
      "Balancer AMO strategy address:",
      cBalancerEthAMOStrategyProxy.address
    );


    // Governance Actions
    // ----------------
    return {
      name: "Deploy Balancer OETH AMO OETH/WETH strategy\n\
      \n\
      This will enable OETH protocol to deploy liquidity to Balancer's OETH/WETH pool\n\
      \n\
      ",
      actions: [
        // TODO remove this if not needed
        //1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // TODO remove this if not needed
        // 2. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Add new strategy to the vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cBalancerEthAMOStrategy.address],
        },
        // 4. Set supported strategy on Harvester
        {
          contract: cOETHHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cBalancerEthAMOStrategy.address, true],
        },
        // 5. Flag the strategy to be an AMO in the OETH Vault
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [cBalancerEthAMOStrategy.address, true],
        },
        // 6. set mint threshold
        {
          contract: cVault,
          signature: "setMintForStrategyThreshold(address,uint256)",
          args: [cBalancerEthAMOStrategy.address, parseUnits("30000")],
        },
        // 5. Set harvester address
        {
          contract: cBalancerEthAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvester.address],
        },
      ],
    };
  }
);
