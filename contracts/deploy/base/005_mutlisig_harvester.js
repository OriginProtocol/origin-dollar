const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "005_mutlisig_harvester",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Proxies
    await deployWithConfirmation("OETHBaseDripperProxy");

    const oethbDripperProxy = await ethers.getContract("OETHBaseDripperProxy");
    const oethbProxy = await ethers.getContract("OETHBaseProxy");
    const oethbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const oethbVault = await ethers.getContractAt(
      "IVault",
      oethbVaultProxy.address
    );

    // Contracts
    await deployWithConfirmation("OETHDripper", [
      oethbVault.address, // OETHb Vault
      addresses.base.WETH, // WETH
    ]);
    const dripperImpl = await ethers.getContract("OETHDripper");
    console.log("OETHDripper implementation deployed at", dripperImpl.address);

    await deployWithConfirmation("OETHVaultValueChecker", [
      oethbVault.address, // OETHb Vault
      oethbProxy.address, // OETHb
    ]);
    const vaultValueChecker = await ethers.getContract("OETHVaultValueChecker");
    console.log("VaultValueChecker deployed at", vaultValueChecker.address);

    // Initialize Dripper Proxy
    // prettier-ignore
    await withConfirmation(
      oethbDripperProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dripperImpl.address, // Implementation
          governorAddr, // Governor multisig
          "0x" // No init data
        )
    );
    console.log("Initialized OETHBaseDripperProxy");

    const cDripper = await ethers.getContractAt(
      "OETHDripper",
      oethbDripperProxy.address
    );

    return {
      actions: [
        {
          // 1. Configure Dripper to 7 days
          contract: cDripper,
          signature: "setDripDuration(uint256)",
          args: [3 * 24 * 60 * 60],
        },
      ],
    };
  }
);
