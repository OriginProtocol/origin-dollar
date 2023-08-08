const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "051_upgrade_buyback",
    forceDeploy: false,
    // Tx: https://etherscan.io/tx/0xeeec3baa4b10c5d86c9509855ee18bb0233f7670b4f7f5015d3183f310083146
    proposalId:
      "11060872832795277890772053218701033437014632045687048548761976103550865282731",
  },
  async ({
    withConfirmation,
    deployWithConfirmation,
    ethers,
    assetAddresses,
  }) => {
    // Signers
    const { timelockAddr, deployerAddr, strategistAddr } =
      await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cOUSD = await ethers.getContractAt("OUSD", cOUSDProxy.address);

    const cOGN = await ethers.getContractAt("MockOGN", assetAddresses.OGN);

    // Vault contract
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Buyback contract with OGN
    const oldBuybackAddress = "0x77314EB392b2be47C014cde0706908b3307Ad6a9";
    const cOldBuyback = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      oldBuybackAddress
    );
    const ognBalance = await cOGN.balanceOf(oldBuybackAddress);

    // Most recent buyback contract
    const recentBuybackAddress = "0x6C5cdfB47150EFc52072cB93Eea1e0F123529748";
    const cRecentBuyback = await ethers.getContractAt(
      ["function transferToken(address token, uint256 amount) external"],
      recentBuybackAddress
    );
    const ousdBalance = await cOUSD.balanceOf(recentBuybackAddress);

    // Deploy Buyback proxy
    const dBuybackProxy = await deployWithConfirmation("BuybackProxy");
    const cBuybackProxy = await ethers.getContractAt(
      "BuybackProxy",
      dBuybackProxy.address
    );

    // Deploy new Buyback implementation contract
    const dBuybackImpl = await deployWithConfirmation("Buyback");

    // Initialize proxy contract
    await withConfirmation(
      cBuybackProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](dBuybackImpl.address, deployerAddr, [], await getTxOpts())
    );

    const cBuyback = await ethers.getContractAt(
      "Buyback",
      cBuybackProxy.address
    );

    // Initialize implementation contract
    const initFunction =
      "initialize(address,address,address,address,address,address,address,address,uint256)";
    await withConfirmation(
      cBuyback.connect(sDeployer)[initFunction](
        assetAddresses.uniswapV3Router,
        strategistAddr,
        strategistAddr, // Treasury manager
        cOUSD.address,
        assetAddresses.OGV,
        assetAddresses.USDT,
        assetAddresses.WETH,
        assetAddresses.RewardsSource,
        "5000", // 50%
        await getTxOpts()
      )
    );

    // Transfer governance of new contract to the governor
    await withConfirmation(
      cBuyback.connect(sDeployer).transferGovernance(timelockAddr)
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade Buyback",
      actions: [
        {
          // 1. Increase performance fee to 20%
          contract: cVaultAdmin,
          signature: "setTrusteeFeeBps(uint256)",
          args: ["2000"], // 20%
        },
        {
          // 2. Claim Governance of the new Buyback contract
          contract: cBuyback,
          signature: "claimGovernance()",
        },
        {
          // 3. Update trustee address on Vault
          contract: cVaultAdmin,
          signature: "setTrusteeAddress(address)",
          args: [cBuyback.address],
        },
        {
          // 4. Transfer OUSD balance to Governor
          contract: cRecentBuyback,
          signature: "transferToken(address,uint256)",
          args: [cOUSDProxy.address, ousdBalance],
        },
        {
          // 5. Transfer OGN balance to Governor
          contract: cOldBuyback,
          signature: "transferToken(address,uint256)",
          args: [cOGN.address, ognBalance],
        },
        {
          // 6. Transfer OUSD balance from Governor to New Contract
          contract: cOUSD,
          signature: "transfer(address,uint256)",
          args: [cBuyback.address, ousdBalance],
        },
        {
          // 7. Transfer OGN balance from Governor to the Strategist
          contract: cOGN,
          signature: "transfer(address,uint256)",
          args: [strategistAddr, ognBalance],
        },
      ],
    };
  }
);
