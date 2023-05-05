const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { isMainnet } = require("../test/helpers.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "052_decimal_cache",
    forceDeploy: false,
    forceSkip: true,
    onlyOnFork: true, // this is only executed in forked environment

    //proposalId: "40434364243407050666554191388123037800510237271029051418887027936281231737485"
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const dOracleRouter = await deployWithConfirmation("OracleRouter");

    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
    const cOracleRouter = await ethers.getContract("OracleRouter");
    await cOracleRouter.cacheDecimals(addresses.mainnet.rETH);
    await cOracleRouter.cacheDecimals(addresses.mainnet.DAI);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDC);
    await cOracleRouter.cacheDecimals(addresses.mainnet.USDT);
    await cOracleRouter.cacheDecimals(addresses.mainnet.COMP);
    await cOracleRouter.cacheDecimals(addresses.mainnet.Aave);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CRV);
    await cOracleRouter.cacheDecimals(addresses.mainnet.CVX);

    const cHarvesterProxy = await ethers.getContract("HarvesterProxy");
    const dHarvester = await deployWithConfirmation("Harvester", [
      cVaultProxy.address,
      assetAddresses.USDT,
    ]);

    const cVaultAdmin = new ethers.Contract(cVaultProxy.address, [
      {
        inputs: [
          {
            internalType: "address",
            name: "_asset",
            type: "address",
          },
        ],
        name: "cacheDecimals",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "_priceProvider",
            type: "address",
          },
        ],
        name: "setPriceProvider",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ]);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new VaultAdmin and cache the decimals of all supported assets",
      actions: [
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.DAI],
        },
        {
          contract: cVaultAdmin,
          signature: "setPriceProvider(address)",
          args: [dOracleRouter.address],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDT],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDC],
        },
        {
          contract: cHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dHarvester.address],
        },
      ],
    };
  }
);
