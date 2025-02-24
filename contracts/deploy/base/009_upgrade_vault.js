const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");

module.exports = deployOnBase(
  {
    deployName: "009_upgrade_vault",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );
    const cOETHbDripperProxy = await ethers.getContract("OETHBaseDripperProxy");

    // Deploy new implementation
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);
    const dOETHbVaultAdmin = await deployWithConfirmation("OETHBaseVaultAdmin");

    return {
      actions: [
        {
          // 1. Upgrade VaultCore
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
        {
          // 2. Upgrade VaultAdmin
          contract: cOETHbVault,
          signature: "setAdminImpl(address)",
          args: [dOETHbVaultAdmin.address],
        },
        {
          // 3. Set allocate threshold
          contract: cOETHbVault,
          signature: "setAutoAllocateThreshold(uint256)",
          args: [utils.parseEther("10")], // 10 OETH
        },
        {
          // 4. Set rebase threshold
          contract: cOETHbVault,
          signature: "setRebaseThreshold(uint256)",
          args: [utils.parseEther("1")], // 1 OETH
        },
        {
          // 5. Max supply diff
          contract: cOETHbVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [utils.parseUnits("0.03", 18)], // 0.03 OETH
        },
        {
          // 6. Set trustee address
          contract: cOETHbVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.base.strategist],
        },
        {
          // 7. Set trustee fee
          contract: cOETHbVault,
          signature: "setTrusteeFeeBps(uint256)",
          args: [2000], // 20%
        },
        {
          // 8. Set Dripper
          contract: cOETHbVault,
          signature: "setDripper(address)",
          args: [cOETHbDripperProxy.address],
        },
      ],
    };
  }
);
