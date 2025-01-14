const { parseEther } = require("ethers/lib/utils");

const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { isFork } = require("../../test/helpers.js");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "002_origin_sonic",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    console.log(`Admin 5/8: ${governorAddr}`);
    console.log(`Guardian 2/8: ${addresses.sonic.guardian}`);
    console.log(`Deployer: ${deployerAddr}`);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    // TODO this needs to change in the actual deploy file
    const sStrategist = await impersonateAndFund(addresses.sonic.guardian);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cWS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);
    const cTimelock = await ethers.getContract("Timelock");

    // Proxies
    const dOSonicProxy = await deployWithConfirmation("OSonicProxy");
    console.log(`Deployed Origin S proxy to ${dOSonicProxy.address}`);

    const dWOSonicProxy = await deployWithConfirmation("WOSonicProxy");
    console.log(`Deployed Wrapped Origin S proxy to ${dWOSonicProxy.address}`);

    const dOSonicVaultProxy = await deployWithConfirmation("OSonicVaultProxy");
    console.log(`Deployed Vault proxy to ${dOSonicVaultProxy.address}`);

    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cWOSonicProxy = await ethers.getContract("WOSonicProxy");
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

    // Core contracts
    const dOSonic = await deployWithConfirmation("OSonic");
    console.log(`Deployed Origin S to ${dOSonic.address}`);

    const dWOSonic = await deployWithConfirmation("WOSonic", [
      cOSonicProxy.address, // Base token
      "Wrapped Origin S", // Token Name
      "wOS", // Token Symbol
    ]);
    console.log(`Deployed Wrapped Origin S to ${dWOSonic.address}`);

    const dOSonicVaultCore = await deployWithConfirmation("OSonicVaultCore", [
      cWS.address,
    ]);
    console.log(`Deployed Vault Core to ${dOSonicVaultCore.address}`);

    const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin", [
      cWS.address,
    ]);
    console.log(`Deployed Vault Admin to ${dOSonicVaultAdmin.address}`);

    // Get contract instances
    const cOSonic = await ethers.getContractAt("OSonic", cOSonicProxy.address);
    const cWOSonic = await ethers.getContractAt(
      "WOSonic",
      cWOSonicProxy.address
    );
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    // Init OSonic
    const resolution = ethers.utils.parseUnits("1", 27);
    const initDataOSonic = cOSonic.interface.encodeFunctionData(
      "initialize(address,uint256)",
      [
        cOSonicVaultProxy.address, // Origin Sonic Vault
        resolution, // HighRes
      ]
    );

    // prettier-ignore
    await cOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonic.address,
      cTimelock.address,
      initDataOSonic
    );
    console.log("Initialized Origin S");

    // Init OSonicVault
    const initDataOSonicVault = cOSonicVault.interface.encodeFunctionData(
      "initialize(address,address)",
      [
        addresses.dead, // OracleRouter
        cOSonicProxy.address, // OSonic
      ]
    );
    // prettier-ignore
    await cOSonicVaultProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonicVaultCore.address,
      governorAddr, // Transferred to Timelock at the end
      initDataOSonicVault
    );
    console.log("Initialized Origin S Vault");

    // Init WOSonic
    const initDataWOSonic = cWOSonic.interface.encodeFunctionData(
      "initialize()",
      []
    );
    // prettier-ignore
    await cWOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dWOSonic.address,
      cTimelock.address,
      initDataWOSonic
    )
    console.log("Initialized Wrapper Origin S");

    await cOSonicVaultProxy
      .connect(sGovernor)
      .upgradeTo(dOSonicVaultCore.address);
    console.log("Upgrade Vault proxy to VaultCore");
    await cOSonicVault
      .connect(sGovernor)
      .setAdminImpl(dOSonicVaultAdmin.address);
    console.log("Set VaultAdmin on Vault");

    await cOSonicVault.connect(sGovernor).supportAsset(cWS.address, 0);
    console.log("Added vault support of Wrapped S");
    await cOSonicVault.connect(sGovernor).unpauseCapital();
    console.log("Unpaused capital");
    await cOSonicVault.connect(sGovernor).setWithdrawalClaimDelay(86400);
    console.log("withdrawal claim delay set to 1 day");

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
        [addresses.sonic.SFC, cOSonicVault.address], // platformAddress, VaultAddress
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
          governorAddr, // Transferred to Timelock at the end
          initSonicStakingStrategy
        )
    );
    console.log("Initialized SonicStakingStrategy proxy and implementation");

    await withConfirmation(
      cOSonicVault
        .connect(sGovernor)
        .approveStrategy(cSonicStakingStrategy.address)
    );
    console.log("Approved Sonic Staking Strategy on Vault");

    // Deploy the Dripper
    const dOSonicDripperProxy = await deployWithConfirmation(
      "OSonicDripperProxy"
    );
    console.log(
      `Deployed Origin Sonic Dripper Proxy to ${dOSonicDripperProxy.address}`
    );
    const cOSonicDripperProxy = await ethers.getContract("OSonicDripperProxy");

    const dFixedRateDripper = await deployWithConfirmation("FixedRateDripper", [
      cOSonicVaultProxy.address, // VaultAddress
      cWS.address,
    ]);
    console.log(`Deployed Fixed Rate Dripper to ${dFixedRateDripper.address}`);

    // Init the Dripper proxy
    // prettier-ignore
    await withConfirmation(
    cOSonicDripperProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dFixedRateDripper.address,
          cTimelock.address,
          "0x"
        )
    );

    await withConfirmation(
      cOSonicVault.connect(sGovernor).setDripper(cOSonicDripperProxy.address)
    );

    // Configure the Vault
    await withConfirmation(
      cOSonicVault.connect(sGovernor).setRebaseThreshold(parseEther("10")) // 10 OS
    );
    // setAutoAllocateThreshold is not set
    await withConfirmation(
      cOSonicVault.connect(sGovernor).setMaxSupplyDiff(parseEther("1")) // 1 OS
    );
    await withConfirmation(
      cOSonicVault
        .connect(sGovernor)
        .setStrategistAddr(addresses.sonic.guardian)
    );
    await withConfirmation(
      cOSonicVault
        .connect(sGovernor)
        .setTrusteeAddress(addresses.sonic.guardian)
    );
    await withConfirmation(
      cOSonicVault.connect(sGovernor).setTrusteeFeeBps(2000) // 20%
    );
    console.log("Configured Vault");

    // verify validators here: https://explorer.soniclabs.com/staking
    for (const validatorId of [15, 16, 17, 18]) {
      await cSonicStakingStrategy
        .connect(sGovernor)
        .supportValidator(validatorId);
    }

    console.log("Added supported validators");

    // Set Defender Relayer for Sonic validator controls
    await cSonicStakingStrategy
      .connect(sGovernor)
      .setRegistrator(addresses.sonic.validatorRegistrator);
    console.log("Set registrator");

    await cSonicStakingStrategy.connect(sStrategist).setDefaultValidatorId(18);
    console.log("Set the default validator id");

    // Deploy the Zapper
    const dOSonicZapper = await deployWithConfirmation("OSonicZapper", [
      cOSonic.address,
      cWOSonic.address,
      cOSonicVault.address,
    ]);
    console.log(`Deployed Origin Sonic Zapper to ${dOSonicZapper.address}`);

    // Deploy the VaultValueChecker
    await deployWithConfirmation("VaultValueChecker", [
      cOSonicVault.address, // Origin Sonic Vault
      cOSonic.address, // Origin Sonic token
    ]);
    const vaultValueChecker = await ethers.getContract("VaultValueChecker");
    console.log(`Deployed Vault Value Checker to ${vaultValueChecker.address}`);

    // Transfer ownership of Vault and Sonic Staking Strategy to Timelock
    await cOSonicVaultProxy
      .connect(sGovernor)
      .transferGovernance(cTimelock.address);
    console.log("Transferred ownership of Vault to Timelock");

    await cSonicStakingStrategyProxy
      .connect(sGovernor)
      .transferGovernance(cTimelock.address);
    console.log("Transferred ownership of Sonic Staking Strategy to Timelock");

    // The Admin multi-sig now needs to `claimGovernance` on the Vault and Sonic Staking Strategy proxies
    if (isFork) {
      const timelock = await impersonateAndFund(cTimelock.address);
      await cOSonicVaultProxy.connect(timelock).claimGovernance();
      await cSonicStakingStrategyProxy.connect(timelock).claimGovernance();
    } else {
      console.log(
        "Admin 5/8 now needs to call claimGovernance on Vault and Sonic Staking Strategy"
      );
    }
  }
);
