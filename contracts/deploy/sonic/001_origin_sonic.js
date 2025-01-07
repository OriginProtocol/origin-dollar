const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "001_origin_sonic",
  },
  async ({ ethers }) => {
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    console.log(`Governor: ${governorAddr}`);
    console.log(`Deployer: ${deployerAddr}`);
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cWS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);

    // Proxies
    await deployWithConfirmation("OSonicProxy");
    console.log("Deployed Origin S proxy");
    await deployWithConfirmation("WOSonicProxy");
    console.log("Deployed Wrapped Origin S proxy");
    await deployWithConfirmation("OSonicVaultProxy");
    console.log("Deployed Vault proxy");

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
    console.log("Deployed Vault Core");
    const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin", [
      cWS.address,
    ]);
    console.log("Deployed Vault Admin");

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
      "initialize(string,string,address,uint256)",
      [
        "Origin S", // Token Name
        "OS", // Token Symbol
        cOSonicVaultProxy.address, // Origin Sonic Vault
        resolution, // HighRes
      ]
    );
    console.log(`cOSonicVaultProxy ${cOSonicVaultProxy.address}`);
    console.log(`dOSonic ${dOSonic.address}`);
    console.log(`governorAddr ${governorAddr}`);
    // prettier-ignore
    await cOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonic.address,
      governorAddr,
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
      governorAddr,
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
      governorAddr,
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

    // Staking Strategy
    await deployWithConfirmation("SonicStakingStrategyProxy");
    console.log("Deployed Sonic Staking Strategy proxy");

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
          deployerAddr,
          initSonicStakingStrategy
        )
    );

    // verify validators here: https://explorer.soniclabs.com/staking
    for (const validatorId of [15, 16, 17, 18]) {
      await cSonicStakingStrategy
        .connect(sDeployer)
        .supportValidator(validatorId)
    }

    // TODO: change to Defender Sonic Relayer
    await cSonicStakingStrategy
      .connect(sDeployer)
      .setRegistrator("0xFacEfACE000000000000000000000000facefaCe");

    console.log("Initialized SonicStakingStrategy proxy and implementation");

    // TODO transfer governor to ?
  }
);
