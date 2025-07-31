const { parseUnits } = require("ethers/lib/utils.js");
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
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    console.log(`Deployer: ${deployerAddr}`);
    console.log(`Strategist: ${strategistAddr}`);
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

    // Deploy a new Wrapped Origin Sonic contract

    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cWOSonicProxy = await ethers.getContract("WOSonicProxy");

    const dWOSonic = await deployWithConfirmation("WOSonic", [
      cOSonicProxy.address, // Base token
      "Wrapped OS", // Token Name
      "wOS", // Token Symbol
    ]);
    console.log(`Deployed Wrapped OS to ${dWOSonic.address}`);

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
        // 4. Set the Sonic Staking Strategy as the default strategy for wS
        {
          contract: cOSonicVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.sonic.wS, cSonicStakingStrategy.address],
        },
        // 5. Set 10% performance fee
        {
          contract: cOSonicVault,
          signature: "setTrusteeFeeBps(uint256)",
          args: [1000],
        },
        // 6. set the trustee address
        {
          contract: cOSonicVault,
          signature: "setTrusteeAddress(address)",
          args: [strategistAddr],
        },
        // 7. Set the Vault buffer to 1%
        {
          contract: cOSonicVault,
          signature: "setVaultBuffer(uint256)",
          args: [parseUnits("1", 16)],
        },
        // 8. Set the auto allocation to 1,000 wS
        {
          contract: cOSonicVault,
          signature: "setAutoAllocateThreshold(uint256)",
          args: [parseUnits("1000", 18)],
        },
        // 9. Upgrade the Wrapped Origin Sonic contract with new name
        {
          contract: cWOSonicProxy,
          signature: "upgradeTo(address)",
          args: [dWOSonic.address],
        },
      ],
    };
  }
);
