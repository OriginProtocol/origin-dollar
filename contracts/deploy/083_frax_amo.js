const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const { convex_frxETH_OETH_PID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "083_frax_amo",
    forceDeploy: false,
    forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are changing the Strategy struct
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

    // Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

    // 2. Deploy new frxETH/OETH AMO strategy
    // Deploy proxy
    const dConvexFrxETHAMOStrategyProxy = await deployWithConfirmation(
      "ConvexFrxETHAMOStrategyProxy"
    );
    const cConvexFrxETHAMOStrategyProxy = await ethers.getContract(
      "ConvexFrxETHAMOStrategyProxy"
    );

    // Deploy and set the immutable variables of implementation
    const dConvexFrxETHAMOStrategy = await deployWithConfirmation(
      "ConvexFrxETHAMOStrategy",
      [
        [
          addresses.mainnet.CurveFrxETHOETHPool,
          addresses.mainnet.OETHVaultProxy,
        ],
        [
          addresses.mainnet.OETHProxy, // oTokenAddress (OETH),
          addresses.mainnet.frxETH, // vaultAssetAddress (frxETH)
          addresses.mainnet.frxETH, // poolAssetAddress (frxETH)
          1, // Curve pool index for OToken OETH
          0, // Curve pool index for asset frxETH
        ],
        [
          addresses.mainnet.CVXBooster, // cvxDepositorAddress,
          addresses.mainnet.CVXFrxETHRewardsPool, // cvxRewardStakerAddress,
          convex_frxETH_OETH_PID, // cvxDepositorPTokenId
        ],
      ]
    );

    const cConvexFrxETHAMOStrategy = await ethers.getContractAt(
      "ConvexFrxETHAMOStrategy",
      dConvexFrxETHAMOStrategyProxy.address
    );

    // 3. Initialize the new frxETH/OETH AMO strategy
    // Construct initialize call data to init and configure the new strategy
    const initData = cConvexFrxETHAMOStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.CRV, addresses.mainnet.CVX],
        [addresses.mainnet.frxETH],
        [addresses.mainnet.CurveFrxETHOETHPool],
      ]
    );

    // prettier-ignore
    await withConfirmation(
        cConvexFrxETHAMOStrategyProxy
              .connect(sDeployer)["initialize(address,address,bytes)"](
                dConvexFrxETHAMOStrategy.address,
                timelockAddr,
                initData,
                await getTxOpts()
              )
          );
    console.log("Initialized Curve frxETH/ETH AMO Strategy");

    const cHarvester = await ethers.getContractAt(
      "OETHHarvester",
      addresses.mainnet.OETHHarvesterProxy
    );

    const cConvexEthMetaStrategy = await ethers.getContractAt(
      "ConvexEthMetaStrategy",
      addresses.mainnet.ConvexOETHAMOStrategy
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault and deploy new AMO strategy for Curve frxETH/OETH pool.",
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
        // 3. Flag the existing AMO strategy for Curve OETH/ETH pool to be an AMO in the OETH Vault
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [cConvexEthMetaStrategy.address, true],
        },
        // 4. Reset the mint threshold for the old AMO strategy as its storage has changed
        {
          contract: cVault,
          signature: "setMintForStrategyThreshold(address,uint256)",
          args: [cConvexEthMetaStrategy.address, parseUnits("25000")],
        },
        // 5. Approve the new frxETH AMO strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [cConvexFrxETHAMOStrategy.address],
        },
        // 6. Flag the new AMO strategy for Curve frxETH/OETH pool to be an AMO in the OETH Vault
        {
          contract: cVault,
          signature: "setAMOStrategy(address,bool)",
          args: [cConvexFrxETHAMOStrategy.address, true],
        },
        // 7. Set the mint threshold for the new frxETH AMO strategy
        {
          contract: cVault,
          signature: "setMintForStrategyThreshold(address,uint256)",
          args: [cConvexFrxETHAMOStrategy.address, parseUnits("25000")],
        },
        // 8. Add the new frxETH AMO strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexFrxETHAMOStrategy.address, true],
        },
        // 9. Set the harvester address on the new frxETH AMO strategy
        {
          contract: cConvexFrxETHAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
