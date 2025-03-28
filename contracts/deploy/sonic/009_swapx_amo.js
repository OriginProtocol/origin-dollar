const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const {
  deploySonicSwapXAMOStrategyImplementation,
} = require("../deployActions");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "009_swapx_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

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

    const initHarvester = cHarvester.interface.encodeFunctionData(
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
              initHarvester
            )
        );

    // Deploy Sonic SwapX AMO Strategy proxy
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVaultAdmin = await ethers.getContractAt(
      "OSonicVaultAdmin",
      cOSonicVaultProxy.address
    );
    await deployWithConfirmation("SonicSwapXAMOStrategyProxy", []);
    const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
      "SonicSwapXAMOStrategyProxy"
    );

    // Deploy Sonic SwapX AMO Strategy implementation
    const cSonicSwapXAMOStrategy =
      await deploySonicSwapXAMOStrategyImplementation();

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
        // 3. Approve new strategy on the Vault
        {
          contract: cOSonicVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 4. Add strategy to mint whitelist
        {
          contract: cOSonicVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 5. Enable for SwapX AMO after it has been deployed
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cSonicSwapXAMOStrategyProxy.address, true],
        },
        // 6. Set the Harvester on the SwapX AMO strategy
        {
          contract: cSonicSwapXAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
