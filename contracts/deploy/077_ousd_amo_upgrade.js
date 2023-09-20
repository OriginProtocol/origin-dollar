const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { metapoolLPCRVPid } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "077_ousd_amo_upgrade",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    // 1. Deploy new OUSD Vault Core and Admin implementations
    // Need to override the storage safety check as we are changing the Strategy struct
    const dVaultCore = await deployWithConfirmation(
      "VaultCore",
      [],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "VaultAdmin",
      [],
      null,
      true
    );

    // Connect to the OUSD Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    const cConvexOUSDMetaStrategyProxy = await ethers.getContract(
      "ConvexOUSDMetaStrategyProxy"
    );

    // Deploy and set the immutable variables
    const dConvexOUSDMetaStrategy = await deployWithConfirmation(
      "ConvexOUSDMetaStrategy",
      [
        [addresses.mainnet.CurveOUSDMetaPool, addresses.mainnet.VaultProxy],
        [
          addresses.mainnet.OUSDProxy, // oTokenAddress (OUSD),
          addresses.mainnet.ThreePoolToken, // assetAddress (3CRV)
          0, // Curve pool index for OUSD
          1, // Curve pool index for 3CRV
        ],
        [
          addresses.mainnet.CVXBooster, // cvxDepositorAddress,
          addresses.mainnet.CVXRewardsPool, // cvxRewardStakerAddress,
          metapoolLPCRVPid, // cvxDepositorPTokenId
        ],
        addresses.mainnet.ThreePool, // _curve3Pool
        [addresses.mainnet.DAI, addresses.mainnet.USDC, addresses.mainnet.USDT], // _curve3PoolAssets
      ],
      null,
      true // force deploy as storage slots have changed
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OUSD AMO strategy.",
      actions: [
        // 1. Upgrade the OUSD Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OUSD Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Flag the existing AMO strategy for Curve OUSD/3CRV pool to be an AMO in the OUSD Vault
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [cConvexOUSDMetaStrategyProxy.address, true],
        },
        // 4. Reset the mint threshold for the old AMO strategy as its storage has changed to 50m
        {
          contract: cVault,
          signature: "setMintForStrategyThreshold(address,uint256)",
          args: [cConvexOUSDMetaStrategyProxy.address, parseUnits("50", 24)],
        },
        // Upgrade the OUSD AMO strategy proxy to the new strategy implementation
        {
          contract: cConvexOUSDMetaStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexOUSDMetaStrategy.address],
        },
        // Set the strategy using the Curve OUSD/3CRV pool to be an AMO
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [cConvexOUSDMetaStrategyProxy.address, true],
        },
      ],
    };
  }
);
