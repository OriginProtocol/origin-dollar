const { deployOnSonic } = require("../../utils/deploy-l2.js");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");
const addresses = require("../../utils/addresses.js");

module.exports = deployOnSonic(
  {
    deployName: "003_sonic_staking_strategy",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    console.log(`Deployer: ${deployerAddr}`);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    // Staking Strategy
    const dSonicStakingStrategyProxy = await deployWithConfirmation(
      "SonicStakingStrategyProxy"
    );
    console.log(
      `Deployed Sonic Staking Strategy proxy to ${dSonicStakingStrategyProxy.address}`
    );

    const cSonicStakingStrategyProxy = await ethers.getContract(
      "SonicStakingStrategyProxy"
    );
    const dSonicStakingStrategy = await deployWithConfirmation(
      "SonicStakingStrategy",
      [
        [addresses.sonic.SFC, cOSonicVaultProxy.address], // platformAddress, VaultAddress
        addresses.sonic.wS,
        addresses.sonic.SFC,
      ]
    );
    console.log(
      `Deployed Sonic Staking Strategy to ${dSonicStakingStrategy.address}`
    );
    const cSonicStakingStrategy = await ethers.getContractAt(
      "SonicStakingStrategy",
      cSonicStakingStrategyProxy.address
    );

    // Init the Sonic Staking Strategy
    const initSonicStakingStrategy =
      cSonicStakingStrategy.interface.encodeFunctionData("initialize()", []);
    // prettier-ignore
    await withConfirmation(
      cSonicStakingStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dSonicStakingStrategy.address,
          addresses.sonic.timelock,
          initSonicStakingStrategy
        )
    );
    console.log("Initialized SonicStakingStrategy proxy and implementation");

    return {
      name: "Config Sonic Staking Strategy",
      actions: [
        // 1. Approve Sonic Staking Strategy on the Vault
        {
          contract: cOSonicVault,
          signature: "approveStrategy(address)",
          args: [cSonicStakingStrategy.address],
        },
        // 2. Add supported validators
        {
          contract: cSonicStakingStrategy,
          signature: "supportValidator(uint256)",
          args: [15],
        },
        {
          contract: cSonicStakingStrategy,
          signature: "supportValidator(uint256)",
          args: [16],
        },
        {
          contract: cSonicStakingStrategy,
          signature: "supportValidator(uint256)",
          args: [17],
        },
        {
          contract: cSonicStakingStrategy,
          signature: "supportValidator(uint256)",
          args: [18],
        },
        // 3. Set Defender Relayer for Sonic validator controls
        {
          contract: cSonicStakingStrategy,
          signature: "setRegistrator(address)",
          args: [addresses.sonic.validatorRegistrator],
        },
      ],
    };
  }
);
