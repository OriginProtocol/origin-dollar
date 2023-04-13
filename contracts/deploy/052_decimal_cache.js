const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { isMainnet } = require("../test/helpers.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "052_decimal_cache",
    forceDeploy: false,
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

    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

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
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDT],
        },
        {
          contract: cVaultAdmin,
          signature: "cacheDecimals(address)",
          args: [assetAddresses.USDC],
        },
      ],
    };
  }
);
