const addresses = require("../../utils/addresses");
const { beaconChainGenesisTimeMainnet } = require("../../utils/constants");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "193_upgrade_compounding_staking_initial_deposit",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
  },
  async ({ deployWithConfirmation, ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cCompoundingStakingStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
    const cCompoundingStakingSSVStrategy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategy",
      cCompoundingStakingStrategyProxy.address
    );
    const cBeaconProofs = await ethers.getContract("BeaconProofs");

    console.log("Deploy CompoundingStakingSSVStrategy");
    const dCompoundingStakingStrategy = await deployWithConfirmation(
      "CompoundingStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSVNetwork, // ssvNetwork
        addresses.mainnet.beaconChainDepositContract, // beaconChainDepositContract
        cBeaconProofs.address, // beaconProofs
        beaconChainGenesisTimeMainnet,
      ]
    );

    return {
      name: "Upgrade the compounding staking strategy initial deposit to 32.25 ETH",
      actions: [
        {
          contract: cCompoundingStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dCompoundingStakingStrategy.address],
        },
        {
          contract: cCompoundingStakingSSVStrategy,
          signature: "setInitialDepositAmount(uint256)",
          args: [ethers.utils.parseEther("32.25")],
        },
      ],
    };
  }
);
