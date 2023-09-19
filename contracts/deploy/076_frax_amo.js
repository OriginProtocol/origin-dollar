const addresses = require("../utils/addresses");
const { frxEthPoolLpPID } = require("../utils/constants");
const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { getTxOpts } = require("../utils/tx");
const { impersonateAndFund } = require("../utils/signers");

const CurveGaugeControllerAbi = require("../test/abi/CurveGaugeController.json");
const ConvexPoolManagerAbi = require("../test/abi/ConvexPoolManager.json");
const ConvexBoosterAbi = require("../test/abi/ConvexBooster.json");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "076_frax_amo",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation, withConfirmation }) => {
    const { deployerAddr, timelockAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // TODO this can be removed once the Curve pool is added to the Convex Pool Manager
    // This requires Curve DAO governance to add CRV rewards to the Curve frxETH/OETH gauge
    // 0. Add the Curve frxETH/OETH pool to the Convex Pool Manager
    const curveGaugeController = await ethers.getContractAt(
      CurveGaugeControllerAbi,
      addresses.mainnet.CurveGaugeController
    );
    const gaugeControllerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";
    const sGaugeControllerAdmin = await impersonateAndFund(
      gaugeControllerAdmin
    );
    console.log("Before add_gauge");
    await withConfirmation(
      curveGaugeController.connect(sGaugeControllerAdmin)[
        // eslint-disable-next-line no-unexpected-multiline
        "add_gauge(address,int128)"
      ](addresses.mainnet.CurveFrxETHOETHGauge, 0)
    );
    console.log("Before change_gauge_weight");
    await withConfirmation(
      curveGaugeController
        .connect(sGaugeControllerAdmin)
        .change_gauge_weight(addresses.mainnet.CurveFrxETHOETHGauge, 100, {
          gasLimit: 2000000,
        })
    );
    console.log("After change_gauge_weight");

    const convexOperatorAddress = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    const convexOperatorSigner = await impersonateAndFund(
      convexOperatorAddress
    );
    const cConvexPoolManager = await ethers.getContractAt(
      ConvexPoolManagerAbi,
      addresses.mainnet.ConvexPoolManager
    );
    const cConvexBooster = await ethers.getContractAt(
      ConvexBoosterAbi,
      addresses.mainnet.CVXBooster
    );

    const poolId = await cConvexBooster.poolLength();
    console.log(`Convex pool id before ${poolId}`);
    await withConfirmation(
      cConvexPoolManager
        .connect(convexOperatorSigner)
        ["addPool(address)"](addresses.mainnet.CurveFrxETHOETHGauge)
    );
    console.log(
      `Convex pool length after ${await cConvexBooster.poolLength()}`
    );
    console.log(`Convex pool info for frxETH/OETH pool:`);
    const info = await cConvexBooster.poolInfo(poolId);
    console.log(`crvRewards: ${info.crvRewards}`);
    console.log(`lptoken: ${info.lptoken}`);
    console.log(`token: ${info.token}`);

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
          addresses.mainnet.frxETH, // assetAddress (frxETH)
          1, // Curve pool index for OToken OETH
          0, // Curve pool index for asset frxETH
        ],
        [
          addresses.mainnet.CVXBooster, // cvxDepositorAddress,
          addresses.mainnet.CVXFrxETHRewardsPool, // cvxRewardStakerAddress,
          frxEthPoolLpPID, // cvxDepositorPTokenId
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
      "initialize(address[])",
      [[addresses.mainnet.CRV, addresses.mainnet.CVX]]
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
        // 4. Approve the new frxETH AMO strategy in the OETH Vault
        {
          contract: cVault,
          signature: "approveStrategy(address,bool)",
          args: [cConvexFrxETHAMOStrategy.address, true],
        },
        // 5. Add the new frxETH AMO strategy to the OETH Harvester
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cConvexFrxETHAMOStrategy.address, true],
        },
        // 6. Set the harvester address on the new frxETH AMO strategy
        {
          contract: cConvexFrxETHAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvester.address],
        },
      ],
    };
  }
);
