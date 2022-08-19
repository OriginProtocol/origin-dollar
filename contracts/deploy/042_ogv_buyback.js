const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "042_ogv_buyback", forceDeploy: true },
  async ({
    withConfirmation,
    deployWithConfirmation,
    ethers,
    assetAddresses,
  }) => {
    // Signers
    const { governorAddr, deployerAddr, strategistAddr } =
      await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const ousd = await ethers.getContract("OUSD");
    const vault = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt(
      "VaultAdmin",
      vault.address
    );

    // Deploy the new Buyback contract
    await deployWithConfirmation("Buyback", [
      assetAddresses.uniswapRouter,
      strategistAddr,
      ousd.address,
      assetAddresses.OGV,
      assetAddresses.USDT,
      assetAddresses.WETH,
      assetAddresses.RewardsSource,
    ]);
    const cBuyback = await ethers.getContract("Buyback");

    // Transfer governance of new contract to the governor
    await withConfirmation(
      cBuyback.connect(sDeployer).transferGovernance(governorAddr)
    );

    // Fetch OUSD and OGN balance of existing contract
    const oldBuybackAddress = await cVault.connect(sDeployer).trusteeAddress();
    const cOldBuyback = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      oldBuybackAddress
    );
    const cOGN = await ethers.getContractAt(
      [
        "function balanceOf(address owner) external view returns (uint256 balance)",
      ],
      assetAddresses.OGN
    );
    const ognBalance = await cOGN.balanceOf(oldBuybackAddress);
    const ousdBalance = await ousd.balanceOf(oldBuybackAddress);

    const balanceTransferProposals = [];

    if (ognBalance.gt(0)) {
      balanceTransferProposals.push({
        // 3. Transfer OUSD balance
        contract: cOldBuyback,
        signature: "transferToken(address,uint256)",
        args: [cOGN.address, ognBalance],
      });
    }

    if (ousdBalance.gt(0)) {
      balanceTransferProposals.push({
        // 4. Transfer OUSD balance
        contract: cOldBuyback,
        signature: "transferToken(address,uint256)",
        args: [ousd.address, ousdBalance],
      });
    }

    // Governance proposal
    return {
      name: "Update Buyback contract to support OGV",
      actions: [
        {
          // 1. Claim Governance of the new contract
          contract: cBuyback,
          signature: "claimGovernance()",
        },
        {
          // 2. Update trustee address on Vault
          contract: cVault,
          signature: "setTrusteeAddress(address)",
          args: [cBuyback.address],
        },
        // Include balance transfer in proposal only if the balance is >0
        ...balanceTransferProposals,
      ],
    };
  }
);
