const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "064_oeth_swapper", forceDeploy: false },
  async ({ deployWithConfirmation, assetAddresses }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault implementation
    // Need to override the storage safety check as we are repacking the
    // internal assets mapping to just use 1 storage slot
    const dOETHVaultImpl = await deployWithConfirmation(
      "OETHVault",
      [],
      null,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = (
      await ethers.getContractAt("OETHVault", cOETHVaultProxy.address)
    ).connect(addresses.mainnet.OldTimelock);

    // 3. Deploy new Swapper contract for 1Inch V5
    const dSwapper = await deployWithConfirmation("Swapper1InchV5");

    // Governance Actions
    // ----------------
    return {
      name: "Deploy OETH collateral swaps",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new implementation
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVaultImpl.address],
        },
        // 2. Set the Swapper on the OETH Vault
        {
          contract: cOETHVault,
          signature: "setSwapper(address)",
          args: [dSwapper.address],
        },
        // 3. Reset the cached asset decimals as the storage slot has been changed
        {
          contract: cOETHVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.RETH],
        },
        {
          contract: cOETHVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.stETH],
        },
        {
          contract: cOETHVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.WETH],
        },
        {
          contract: cOETHVault,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.frxETH],
        },
        // 4. Set the allowed swap slippages for each vault collateral asset
        {
          contract: cOETHVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.RETH, 200], // 2% Oracle deviation threshold
        },
        {
          contract: cOETHVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.stETH, 70], // 0.2% + 0.5% Oracle deviation threshold
        },
        {
          contract: cOETHVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.WETH, 20], // 0.2%
        },
        {
          contract: cOETHVault,
          signature: "setSwapSlippage(address,uint16)",
          args: [assetAddresses.frxETH, 20], // 0.2%
        },
      ],
    };
  }
);
