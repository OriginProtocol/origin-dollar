const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "064_oeth_swapper", forceDeploy: false, reduceQueueTime: true },
  async ({ assetAddresses, deployWithConfirmation, withConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are repacking the
    // internal assets mapping to just use 1 storage slot
    const dVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [],
      null,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = (
      await ethers.getContractAt("OETHVault", cVaultProxy.address)
    ).connect(addresses.mainnet.OldTimelock);

    // 3. Deploy new Swapper contract for 1Inch V5
    const dSwapper = await deployWithConfirmation("Swapper1InchV5");
    const cSwapper = await ethers.getContract("Swapper1InchV5");

    await withConfirmation(
      cSwapper.approveAssets([
        assetAddresses.RETH,
        assetAddresses.stETH,
        assetAddresses.WETH,
        assetAddresses.frxETH,
      ])
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to support collateral swaps",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Set the Swapper on the OETH Vault
        {
          contract: cVault,
          signature: "setSwapper(address)",
          args: [dSwapper.address],
        },
        // 4. Reset the cached asset decimals as the storage slot has been changed
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.RETH],
        },
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.stETH],
        },
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.WETH],
        },
        {
          contract: cVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.frxETH],
        },
        // 5. Set the allowed swap slippages for each vault collateral asset
        {
          contract: cVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.RETH, 200], // 2% Oracle deviation threshold
        },
        {
          contract: cVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.stETH, 70], // 0.2% + 0.5% Oracle deviation threshold
        },
        {
          contract: cVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.WETH, 20], // 0.2%
        },
        {
          contract: cVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.frxETH, 20], // 0.2%
        },
      ],
    };
  }
);
