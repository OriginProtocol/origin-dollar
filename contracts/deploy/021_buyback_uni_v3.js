const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "021_buyback_uni_v3" },
  async ({
    assetAddresses,
    ethers,
    deployWithConfirmation,
    withConfirmation,
    getTxOpts,
  }) => {
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    const sDeployer = ethers.provider.getSigner(deployerAddr);

    const cOldBuyback = await ethers.getContract("Buyback");
    const cOUSD = await ethers.getContractAt("OUSD", assetAddresses.OUSD);
    const cOGN = await ethers.getContractAt("MockOGN", assetAddresses.OGN);
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Deploy new contract
    await deployWithConfirmation("Buyback");

    // Initiate transfer of Buyback governance to the governor
    const cNewBuyback = await ethers.getContract("Buyback");
    await withConfirmation(
      cNewBuyback
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Balances to send from old contract to new
    const ousdBalance = await cOUSD.balanceOf(cOldBuyback.address);
    const ognBalance = await cOGN.balanceOf(cNewBuyback.address);

    // Governance proposal
    return {
      name: "Switch to new buyback contract which supports uniswap V3",
      actions: [
        {
          // Claim governance
          contract: cNewBuyback,
          signature: "claimGovernance()",
        },
        {
          // Switch vault over to using new contract
          contract: cVaultAdmin,
          signature: "setTrusteeAddress()",
          args: [cNewBuyback.address],
        },
        {
          // Collect old OUSD
          contract: cOldBuyback,
          signature: "transferToken()",
          args: [cOUSD.address, ousdBalance],
        },
        {
          // Move old OUSD forward to new contract
          contract: cOUSD,
          signature: "transfer()",
          args: [cNewBuyback.address, ousdBalance],
        },
        {
          // Collect old OGN
          contract: cOldBuyback,
          signature: "transferToken()",
          args: [cOGN.address, ognBalance],
        },
        {
          // Move old OGN forward to new contract
          contract: cOGN,
          signature: "transfer()",
          args: [cNewBuyback.address, ognBalance],
        },
      ],
    };
  }
);
