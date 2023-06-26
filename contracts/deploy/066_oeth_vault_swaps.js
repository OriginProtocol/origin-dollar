const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "066_oeth_vault_swaps",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId: 54,
  },
  async ({ assetAddresses, deployWithConfirmation }) => {
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
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
    const cSwapper = await ethers.getContract("Swapper1InchV5");

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
          args: [cSwapper.address],
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
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.RETH, 200], // 2% Oracle deviation threshold
        },
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.stETH, 70], // 0.2% + 0.5% Oracle deviation threshold
        },
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.WETH, 20], // 0.2%
        },
        {
          contract: cVault,
          signature: "setOracleSlippage(address,uint16)",
          args: [assetAddresses.frxETH, 20], // 0.2%
        },
        // 6. Set max allowed percentage the vault total value can drop below the OToken total supply when executing collateral swaps.
        {
          contract: cVault,
          signature: "setSwapAllowedUndervalue(uint16)",
          args: [50], // 0.5%
        },
      ],
    };
  }
);
