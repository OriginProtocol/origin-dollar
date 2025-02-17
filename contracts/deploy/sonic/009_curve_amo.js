const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "009_curve_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Sonic Curve AMO Strategy proxy
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVaultAdmin = await ethers.getContractAt(
      "OSonicVaultAdmin",
      cOSonicVaultProxy.address
    );

    const dSonicCurveAMOStrategyProxy = await deployWithConfirmation(
      "SonicCurveAMOStrategyProxy",
      []
    );

    const cSonicCurveAMOStrategyProxy = await ethers.getContract(
      "SonicCurveAMOStrategyProxy"
    );

    // Deploy Sonic Curve AMO Strategy implementation
    const dSonicCurveAMOStrategy = await deployWithConfirmation(
      "SonicCurveAMOStrategy",
      [
        [addresses.sonic.WS_OS.pool, cOSonicVaultProxy.address],
        cOSonicProxy.address,
        addresses.sonic.wS,
        addresses.sonic.WS_OS.gauge,
        addresses.sonic.childLiquidityGaugeFactory,
        0, // The OToken (OS for Sonic) is coin 0 of the Curve OS/wS pool
        1, // The WETH token (wS for Sonic) is coin 1 of the Curve OS/wS pool
      ]
    );
    const cSonicCurveAMOStrategy = await ethers.getContractAt(
      "SonicCurveAMOStrategy",
      dSonicCurveAMOStrategyProxy.address
    );

    // Initialize Sonic Curve AMO Strategy implementation
    const initData = cSonicCurveAMOStrategy.interface.encodeFunctionData(
      "initialize(address[],uint256)",
      [[addresses.sonic.CRV], oethUnits("0.002")]
    );
    await withConfirmation(
      // prettier-ignore
      cSonicCurveAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dSonicCurveAMOStrategy.address,
          addresses.sonic.timelock,
          initData
        )
    );

    // Deploy a new Vault Core implementation
    const dOSonicVaultCore = await deployWithConfirmation("OSonicVaultCore", [
      addresses.sonic.wS,
    ]);
    console.log(`Deployed Vault Core to ${dOSonicVaultCore.address}`);

    // Deploy a new Vault Admin implementation
    const dOSonicVaultAdmin = await deployWithConfirmation("OSonicVaultAdmin", [
      addresses.sonic.wS,
    ]);
    console.log(
      `Deployed Origin Sonic Vault Admin to ${dOSonicVaultAdmin.address}`
    );

    // Deploy the Harvester proxy
    await deployWithConfirmation("OSonicHarvesterProxy");

    // Deploy the Harvester implementation
    await deployWithConfirmation("OETHHarvesterSimple", [addresses.sonic.wS]);
    const dHarvester = await ethers.getContract("OETHHarvesterSimple");

    const cHarvesterProxy = await ethers.getContract("OSonicHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cHarvesterProxy.address
    );

    const cDripperProxy = await ethers.getContract("OSonicDripperProxy");

    const initSonicStakingStrategy = cHarvester.interface.encodeFunctionData(
      "initialize(address,address,address)",
      [addresses.sonic.timelock, strategistAddr, cDripperProxy.address]
    );

    // Initialize the Harvester
    // prettier-ignore
    await withConfirmation(
      cHarvesterProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dHarvester.address,
          addresses.sonic.timelock,
          initSonicStakingStrategy
        )
    );

    return {
      actions: [
        // 1. Upgrade Vault proxy to new VaultCore
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVaultCore.address],
        },
        // 2. Upgrade the VaultAdmin
        {
          contract: cOSonicVaultAdmin,
          signature: "setAdminImpl(address)",
          args: [dOSonicVaultAdmin.address],
        },
        // 3. Approve strategy on vault
        {
          contract: cOSonicVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cSonicCurveAMOStrategyProxy.address],
        },
        // 4. Add strategy to mint whitelist
        {
          contract: cOSonicVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cSonicCurveAMOStrategyProxy.address],
        },
        // 5. Enable for Curve AMO after it has been deployed
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cSonicCurveAMOStrategyProxy.address, true],
        },
        // 6. Set the Harvester on the Curve AMO strategy
        {
          contract: cSonicCurveAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
