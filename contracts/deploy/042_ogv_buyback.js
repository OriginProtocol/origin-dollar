const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "042_ogv_buyback", forceDeploy: false },
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

    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);
    const cOGN = await ethers.getContractAt(
      [
        "function transfer(address to, uint256 value) public returns (bool success)",
        "function balanceOf(address owner) external view returns (uint256 balance)",
      ],
      assetAddresses.OGN
    );
    const vault = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("VaultAdmin", vault.address);

    const oldBuybackAddress = "0x77314EB392b2be47C014cde0706908b3307Ad6a9";
    const cOldBuyback = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      oldBuybackAddress
    );

    // Fetch OUSD and OGN balance of existing contract
    const ognBalance = await cOGN.balanceOf(oldBuybackAddress);
    const ousdBalance = await cOUSD.balanceOf(oldBuybackAddress);

    // Deploy the new Buyback contract
    await deployWithConfirmation("Buyback", [
      assetAddresses.uniswapV3Router,
      strategistAddr,
      cOUSD.address,
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
        {
          // 3. Transfer OGN balance to Governor
          contract: cOldBuyback,
          signature: "transferToken(address,uint256)",
          args: [cOGN.address, ognBalance],
        },
        {
          // 4. Transfer OGN balance from Governor to New Contract
          contract: cOGN,
          signature: "transfer(address,uint256)",
          args: [cBuyback.address, ognBalance],
        },
        {
          // 5. Transfer OUSD balance to Governor
          contract: cOldBuyback,
          signature: "transferToken(address,uint256)",
          args: [cOUSDProxy.address, ousdBalance],
        },
        {
          // 6. Transfer OUSD balance from Governor to New Contract
          contract: cOUSD,
          signature: "transfer(address,uint256)",
          args: [cBuyback.address, ousdBalance],
        },
      ],
    };
  }
);
