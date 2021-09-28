const hre = require("hardhat");

const addresses = require("../utils/addresses");
const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "022_upgrade_all" },
  async ({
    oracleAddresses,
    assetAddresses,
    ethers,
    deployWithConfirmation,
    withConfirmation,
  }) => {
    const { governorAddr } = await hre.getNamedAccounts();

    // Vault and OUSD contracts
    const dOUSD = await deployWithConfirmation("OUSD");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dVaultCore = await deployWithConfirmation("VaultCore");
    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    await deployWithConfirmation("Governor", [governorAddr, 60]);

    // Oracle contract
    const dOracleRouter = await deployWithConfirmation("OracleRouter");

    // Buyback contract
    await deployWithConfirmation("Buyback", [
      assetAddresses.uniswapRouter,
      cVaultProxy.address,
      cOUSDProxy.address,
      assetAddresses.OGN,
      assetAddresses.USDT,
      assetAddresses.WETH,
      oracleAddresses.chainlink.OGN_ETH,
      oracleAddresses.chainlink.ETH_USD,
    ]);
    const cBuyback = await ethers.getContract("Buyback");
    // Transfer Buyback governance to governor
    await withConfirmation(cBuyback.transferGovernance(governorAddr));

    // CompoundStrategy contracts
    const cOldCompoundStrategyProxy = await ethers.getContractAt(
      "CompoundStrategyProxy"
    );
    const dCompoundStrategyProxy = await deployWithConfirmation(
      "CompoundStrategyProxy",
      [],
      "InitializeGovernedUpgradeabilityProxy"
    );
    const cCompoundStrategyProxy = await ethers.getContractAt(
      "CompoundStrategyProxy"
    );
    await deployWithConfirmation("CompoundStrategy");
    const cCompoundStrategy = await ethers.getContractAt(
      "CompoundStrategy",
      dCompoundStrategyProxy.address
    );
    // Transfer CompoundStrategy governance to governor
    await withConfirmation(cCompoundStrategy.transferGovernance(governorAddr));

    // Deploy Aave strategy
    const dAaveStrategyProxy = await deployWithConfirmation(
      "AaveStrategyProxy",
      [],
      "InitializeGovernedUpgradeabilityProxy"
    );
    const cAaveStrategyProxy = await ethers.getContractAt("AaveStrategyProxy");
    await deployWithConfirmation("AaveStrategy");
    const cAaveStrategy = await ethers.getContractAt(
      "AaveStrategy",
      dAaveStrategyProxy.address
    );
    await withConfirmation(cAaveStrategy.transferGovernance(governorAddr));

    // Flipper
    await deployWithConfirmation("Flipper", [
      assetAddresses.DAI,
      cOUSDProxy.address,
      assetAddresses.USDC,
      assetAddresses.USDT,
    ]);
    const cFlipper = await ethers.getContract("Flipper");
    await withConfirmation(cFlipper.transferGovernance(governorAddr));

    // Governance proposal
    return {
      name: "Deploy all new contracts and migrate all funds",
      actions: [
        {
          // Claim governance of buyback
          contract: cBuyback,
          signature: "claimGovernance()",
        },
        {
          // Claim governance of flipper
          contract: cFlipper,
          signature: "claimGovernance()",
        },
        {
          // Upgrade OUSD implementation
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSD.address],
        },
        {
          // Set VaultCore implementation
          contract: cVaultProxy,
          signature: "upgradeTo",
          args: [dVaultCore.address],
        },
        {
          // Set VaultAdmin implementation
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        {
          // Set new trustee
          contract: cVault,
          signature: "setTrusteeAddress(address)",
          args: cBuyback.address,
        },
        {
          // Set new oracle address
          contract: cVault,
          signature: "setPriceProvider(address)",
          args: dOracleRouter.address,
        },
        {
          // Add DAI as a swap token
          contract: cVault,
          signature: "addSwapToken(address)",
          args: assetAddresses.DAI,
        },
        {
          // Add USDT as a swap token
          contract: cVault,
          signature: "addSwapToken(address)",
          args: assetAddresses.USDT,
        },
        {
          // Add USDC as a swap token
          contract: cVault,
          signature: "addSwapToken(address)",
          args: assetAddresses.USDC,
        },
        {
          // Remove old Compound strategy
          contract: cVault,
          signature: "removeStrategy(address)",
          args: cOldCompoundStrategyProxy.address,
        },
        {
          // Initialize Compound strategy proxy
          contract: cCompoundStrategyProxy,
          signature: "initialize(address,address,bytes)",
          args: [cCompoundStrategy.address, governorAddr, []],
        },
        {
          // Initialize Compound strategy
          contract: cCompoundStrategy,
          signature: "initialize(address,address,address,address[],address[])",
          args: [
            addresses.dead,
            cVaultProxy.address,
            assetAddresses.COMP,
            [assetAddresses.DAI],
            [assetAddresses.cDAI],
          ],
        },
        {
          // Claim Governance of Compound strategy
          contract: cCompoundStrategy,
          signature: "claimGovernance()",
        },
        {
          // Initialize Aave strategy proxy
          contract: cAaveStrategyProxy,
          signature: "initialize(address,address,bytes)",
          args: [cAaveStrategy.address, governorAddr, []],
        },
        {
          // Initialize Aave strategy
          contract: cAaveStrategy,
          signature:
            "initialize(address,address,address,address[],address[],address,address)",
          args: [
            assetAddresses.AAVE_ADDRESS_PROVIDER,
            cVault.address,
            assetAddresses.AAVE,
            [assetAddresses.DAI],
            [assetAddresses.aDAI],
            assetAddresses.AAVE_INCENTIVES_CONTROLLER,
            assetAddresses.STKAAVE,
          ],
        },
        {
          // Claim governance of Aave strategy
          contract: cAaveStrategy,
          signature: "claimGovernance()",
        },
        {
          // Approve Compound strategy in Vault
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cCompoundStrategyProxy.address],
        },
        {
          // Add Compound as default USDT strategy
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.USDT, cCompoundStrategyProxy.address],
        },
        {
          // Addd Compound as default USDC strategy
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.USDC, cCompoundStrategyProxy.address],
        },
        {
          // Approve AAVE strategy in Vault
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cAaveStrategyProxy.address],
        },
        {
          // Add AAVE as default DAI strategy
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [assetAddresses.DAI, cAaveStrategyProxy.address],
        },
      ],
    };
  }
);
