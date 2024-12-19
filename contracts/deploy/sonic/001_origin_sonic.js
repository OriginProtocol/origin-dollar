const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "001_origin_sonic",
  },
  async ({ ethers }) => {
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cWS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);

    // Proxies
    await deployOnSonic("OSonicProxy");
    console.log("Deployed Origin S proxy");
    await deployOnSonic("WOSonicProxy");
    console.log("Deployed Wrapped Origin S proxy");
    await deployOnSonic("OSonicVaultProxy");
    console.log("Deployed Vault proxy");

    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cWOSonicProxy = await ethers.getContract("WOSonicProxy");
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

    // Core contracts
    const dOSonic = await deployOnSonic("OSonic");
    console.log("Deployed Origin S");
    const dWOSonic = await deployOnSonic("WOSonic", [
      cOSonicProxy.address, // Base token
      "Wrapped Origin S", // Token Name
      "wOS", // Token Symbol
    ]);
    console.log("Deployed Wrapped Origin S");
    const dOSonicVaultCore = await deployOnSonic("OSonicVaultCore", [
      cWS.address,
    ]);
    console.log("Deployed Vault Core");
    const dOSonicVaultAdmin = await deployOnSonic("OSonicVaultAdmin", [
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
    // prettier-ignore
    await cOSonicProxy
    .connect(sDeployer)["initialize(address,address,bytes)"](
      dOSonic.address,
      governorAddr,
      initDataOSonic
    );

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

    await cOSonicVaultProxy
      .connect(sGovernor)
      .upgradeTo(dOSonicVaultCore.address);
    await cOSonicVault
      .connect(sGovernor)
      .setAdminImpl(dOSonicVaultAdmin.address);

    await cOSonicVault.connect(sGovernor).supportAsset(cWS.address, 0);
    await cOSonicVault.connect(sGovernor).unpauseCapital();
  }
);
