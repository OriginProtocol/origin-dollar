const hre = require("hardhat");
const { parseUnits } = require("ethers/lib/utils");
const addresses = require("../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const balancerFactoryAbi = require("../test/abi/balancerWeightedPoolFactoryV4.json");
const auraGaugeFactoryAbi = require("../test/abi/auraGaugeFactory.json");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "080_oeth_balancer_amo",
    forceDeploy: false,
    forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation, getTxOpts }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const { poolId, poolAddress, gaugeAddress } = await deployBalancerPoolAndGauge();

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
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );

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
        // TODO change platformAddress to Balancer pool address
        [poolAddress, cVaultProxy.address], // BaseStrategyConfig[platformAddress, vaultAddress]
        [
          /// AMOConfig[oTokenAddress, assetAddress, oTokenCoinIndex, assetCoinIndex, oTokenWeight, assetWeight]
          addresses.mainnet.OETHProxy,
          addresses.mainnet.WETH,
          0, // TODO update
          1, // TODO update
          `${0.5*1e18}`, // oToken weight
          `${0.5*1e18}` // asset weight
        ],
        [
          // BalancerConfig[balancerVault, balancerPoolId, auraRewardPool]
          addresses.mainnet.balancerVault,
          poolId, // TODO change
          gaugeAddress, // TODO change
        ],
      ]
    );

    const cBalancerEthAMOStrategy = await ethers.getContractAt(
      "BalancerEthAMOStrategy",
      dBalancerEthAMOStrategyProxy.address
    );

    // 3. Encode the init data initialize it with the initialization of the proxy
    const initData = cBalancerEthAMOStrategy.interface.encodeFunctionData(
      "initialize(address[])", // [_rewardTokenAddresses]
      [[addresses.mainnet.rETH, addresses.mainnet.WETH]]
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

/* IMPORTANT!
 *
 * Deploy and fund the Balancer pool for the strategy to interact with.
 * DELETE when the pool exists on the mainnet.
 */
const deployBalancerPoolAndGauge = async () => {
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);

  const balancerFactory = await ethers.getContractAt(
    balancerFactoryAbi,
    addresses.mainnet.balancerWeightedPoolFactoryV4
  );
  const auraGaugeFactory = await ethers.getContractAt(
    auraGaugeFactoryAbi,
    addresses.mainnet.AuraGaugeFactory
  );

  // Create balancer pool
  const name = "OETH-WETH";
  const tx = await balancerFactory.connect(sDeployer).create(
    name, // name
    name, // symbol
    [addresses.mainnet.OETHProxy, addresses.mainnet.WETH], // pool tokens
    [`${0.8 * 1e18}`, `${0.2 * 1e18}`], // normalized weights
    [addresses.zero, addresses.zero], // rate provider
    "400000000000000", // 0.04% swap fee
    addresses.zero, // owner
    // salt is used to create predictable addresses using create2 call
    "0x029174bcd5f98166762506f0de32466ccacc44c3cd7302690e0307a0b45d7ac7" // salt
  );
  const res = await tx.wait();

  const poolId = res.events[1].topics[1];
  const poolAddress = res.events[1].topics[1].substring(0, 42);

  // Create Aura Gauge
  const tx1 = await auraGaugeFactory.create(
    poolAddress,
    "20000000000000000" // 2% capped gauge
  );

  const res1 = await tx1.wait();
  const gaugeAddress = "0x" + res1.events[0].topics[1].substring(26);

  return {
    poolId,
    poolAddress,
    gaugeAddress,
  };
};