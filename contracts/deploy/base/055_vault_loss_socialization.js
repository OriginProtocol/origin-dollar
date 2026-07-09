const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { parseUnits } = require("ethers/lib/utils");

// See deploy/mainnet/202_vault_loss_socialization.js for the meaning of these.
// NOTE: confirm these policy values with governance before submitting.
const MAX_SUPPLY_DIFF = parseUnits("0.2", 18); // 20%
const MINT_TOLERANCE = parseUnits("0.01", 18); // 1%

module.exports = deployOnBase(
  {
    deployName: "055_vault_loss_socialization",
  },
  async ({ ethers }) => {
    // 1. Deploy new OETHBaseVault implementation
    const dOETHbVault = await deployWithConfirmation(
      "OETHBaseVault",
      [addresses.base.WETH],
      "OETHBaseVault",
      true
    );

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    return {
      name: "Socialise withdrawal-queue losses on the superOETHb vault",
      actions: [
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVault.address],
        },
        {
          contract: cOETHbVault,
          signature: "setMaxSupplyDiff(uint256)",
          args: [MAX_SUPPLY_DIFF],
        },
        {
          contract: cOETHbVault,
          signature: "setMintTolerance(uint256)",
          args: [MINT_TOLERANCE],
        },
      ],
    };
  }
);
