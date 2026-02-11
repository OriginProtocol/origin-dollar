const { parseEther } = require("ethers/lib/utils");

const { deployOnSonic } = require("../../utils/deploy-l2.js");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");
const addresses = require("../../utils/addresses.js");

module.exports = deployOnSonic(
  {
    deployName: "001_vault_and_token",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const { deployerAddr, strategistAddr } = await getNamedAccounts();
    console.log(`Deployer: ${deployerAddr}`);
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cWS = await ethers.getContractAt("IWrappedSonic", addresses.sonic.wS);

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

    const dOSonicVault = await deployWithConfirmation("OSonicVault", [
      cWS.address,
    ]);
    console.log(`Deployed Vault Admin to ${dOSonicVault.address}`);

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
        addresses.sonic.timelock,
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
        addresses.sonic.timelock,
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
        addresses.sonic.timelock,
        initDataWOSonic
      )
    console.log("Initialized Wrapper Origin S");

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
          addresses.sonic.timelock,
          "0x"
        )
    );

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

    return {
      name: "Config Tokens and Vault",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVaultCore.address],
        },
        // 2. Set the VaultAdmin
        {
          contract: cOSonicVault,
          signature: "setAdminImpl(address)",
          args: [dOSonicVault.address],
        },
        // 3. Support wrapped S
        {
          contract: cOSonicVault,
          signature: "supportAsset(address,uint8)",
          args: [cWS.address, 0], // 0 -> UnitConversion.DECIMALS
        },
        // 4. Unpause capital
        {
          contract: cOSonicVault,
          signature: "unpauseCapital()",
          args: [],
        },
        // 5. withdrawal claim delay set to 1 day
        {
          contract: cOSonicVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [86400],
        },
        // 6. Configure the Vault
        {
          contract: cOSonicVault,
          signature: "setRebaseThreshold(uint256)",
          args: [parseEther("10")], // 10 OS
        },
        // 7. set setAutoAllocateThreshold
        {
          contract: cOSonicVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [parseEther("1")], // 1 OS
        },
        // 8. set guardian / strategist
        {
          contract: cOSonicVault,
          signature: "setStrategistAddr(address)",
          args: [strategistAddr],
        },
        // 9. Set the Dripper on the Vault
        {
          contract: cOSonicVault,
          signature: "setDripper(address)",
          args: [cOSonicDripperProxy.address],
        },
      ],
    };
  }
);
