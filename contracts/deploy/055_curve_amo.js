const {
  deploymentWithGuardianGovernor,
  impersonateAccount,
} = require("../utils/deploy");
const addresses = require("../utils/addresses");
const hre = require("hardhat");
const { utils, Contract } = require("ethers");
const { getAssetAddresses, isMainnet } = require("../test/helpers.js");
const { MAX_UINT256, oethPoolLpPID } = require("../utils/constants");
const crvRewards = "0x24b65DC1cf053A8D96872c323d29e86ec43eB33A";
const poolAddress = "0x94b17476a93b3262d87b9a326965d1e91f9c13e7";
const tokenAddress = "0x94b17476a93b3262d87b9a326965d1e91f9c13e7";

// 5/8 multisig
const guardianAddr = addresses.mainnet.Guardian;

module.exports = deploymentWithGuardianGovernor(
  {
    deployName: "055_curve_amo",
    reduceQueueTime: true,
  },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    let actions = [];
    // No need to Deploy Curve since it is already live on the mainnet

    // let {
    //   actions
    // } = await deployCurve({
    //   deployWithConfirmation,
    //   withConfirmation,
    //   ethers,
    // });

    const { cHarvester, actions: harvesterActions } =
      await deployHarvesterAndOracleRouter({
        deployWithConfirmation,
        withConfirmation,
        ethers,
      });

    actions = actions.concat(harvesterActions);

    // actions = actions.concat(await reDeployOETH({
    //   deployWithConfirmation,
    //   withConfirmation,
    //   ethers
    // }));

    actions = actions.concat(
      await configureDripper({
        deployWithConfirmation,
        withConfirmation,
        ethers,
        cHarvester,
      })
    );

    actions = actions.concat(
      await deployConvexETHMetaStrategy({
        deployWithConfirmation,
        withConfirmation,
        ethers,
        cHarvester,
      })
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy Curve AMO, Harvester, Dripper and Oracle Router",
      actions,
    };
  }
);

const configureDripper = async ({ ethers, cHarvester }) => {
  const cDripperProxy = await ethers.getContract("OETHDripperProxy");
  const cDripper = await ethers.getContractAt(
    "OETHDripper",
    cDripperProxy.address
  );

  return [
    {
      // 1. Configure Dripper to three days
      contract: cDripper,
      signature: "setDripDuration(uint256)",
      args: [3 * 24 * 60 * 60],
    },
    {
      contract: cHarvester,
      signature: "setRewardsProceedsAddress(address)",
      args: [cDripper.address],
    },
  ];
};

/**
 * Deploy Convex ETH Strategy
 */
const deployConvexETHMetaStrategy = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
  cHarvester,
}) => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

  const dConvexEthMetaStrategyProxy = await deployWithConfirmation(
    "ConvexEthMetaStrategyProxy"
  );
  const cConvexEthMetaStrategyProxy = await ethers.getContract(
    "ConvexEthMetaStrategyProxy"
  );
  const dConvexETHMetaStrategy = await deployWithConfirmation(
    "ConvexEthMetaStrategy"
  );
  const cConvexETHMetaStrategy = await ethers.getContractAt(
    "ConvexEthMetaStrategy",
    dConvexEthMetaStrategyProxy.address
  );
  await withConfirmation(
    cConvexEthMetaStrategyProxy.connect(sDeployer)[
      // eslint-disable-next-line no-unexpected-multiline
      "initialize(address,address,bytes)"
    ](dConvexETHMetaStrategy.address, deployerAddr, [])
  );

  console.log("Initialized ConvexETHMetaStrategyProxy");
  const initFunction =
    "initialize(address[],address[],address[],(address,address,address,address,address,address,address,uint256))";

  await withConfirmation(
    cConvexETHMetaStrategy
      .connect(sDeployer)
      // eslint-disable-next-line no-unexpected-multiline
      [initFunction](
        [assetAddresses.CVX, assetAddresses.CRV],
        [addresses.mainnet.WETH],
        [tokenAddress],
        [
          poolAddress,
          cVaultProxy.address,
          addresses.mainnet.CVXBooster,
          addresses.mainnet.OETHProxy,
          crvRewards,
          tokenAddress,
          oethPoolLpPID,
        ]
      )
  );
  console.log("Initialized ConvexETHMetaStrategy");
  await withConfirmation(
    cConvexETHMetaStrategy.connect(sDeployer).transferGovernance(guardianAddr)
  );
  console.log(
    `ConvexETHMetaStrategy transferGovernance(${guardianAddr} called`
  );

  return [
    {
      // Claim Vault governance
      contract: cConvexETHMetaStrategy,
      signature: "claimGovernance()",
      args: [],
    },
    {
      // Approve strategy
      contract: cVault,
      signature: "approveStrategy(address)",
      args: [cConvexETHMetaStrategy.address],
    },
    {
      // Set ConvexEthMeta strategy as the Vault strategy that can print OETH
      contract: cVault,
      signature: "setOusdMetaStrategy(address)",
      args: [cConvexETHMetaStrategy.address],
    },
    {
      // Set OETH mint threshold to 25k
      contract: cVault,
      signature: "setNetOusdMintForStrategyThreshold(uint256)",
      args: [utils.parseUnits("25", 21)],
    },
    {
      // Set harvester address
      contract: cConvexETHMetaStrategy,
      signature: "setHarvesterAddress(address)",
      args: [cHarvester.address],
    },
    // set ConvexEth strategy as supported one by harvester
    {
      contract: cHarvester,
      signature: "setSupportedStrategy(address,bool)",
      args: [cConvexETHMetaStrategy.address, true],
    },
    // Set reward token config
    {
      contract: cHarvester,
      signature:
        "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
      args: [
        assetAddresses.CRV, // tokenAddress
        300, // allowedSlippageBps
        100, // harvestRewardBps
        assetAddresses.sushiswapRouter, // uniswapV2CompatibleAddr
        MAX_UINT256, // liquidationLimit
        true, // doSwapRewardToken
      ],
    },
    // Set reward token config
    {
      contract: cHarvester,
      signature:
        "setRewardTokenConfig(address,uint16,uint16,address,uint256,bool)",
      args: [
        assetAddresses.CVX, // tokenAddress
        300, // allowedSlippageBps
        100, // harvestRewardBps
        assetAddresses.sushiswapRouter, // uniswapV2CompatibleAddr
        MAX_UINT256, // liquidationLimit
        true, // doSwapRewardToken
      ],
    },
  ];
};

const deployHarvesterAndOracleRouter = async ({
  deployWithConfirmation,
  withConfirmation,
  ethers,
}) => {
  await deployWithConfirmation("OETHOracleRouter");

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const dHarvesterProxy = await deployWithConfirmation("OETHHarvesterProxy");
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
  const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");
  console.log(`Harvester proxy deployed at: ${dHarvesterProxy.address}`);

  const cHarvesterProxy = await ethers.getContractAt(
    "OETHHarvesterProxy",
    dHarvesterProxy.address
  );

  const dHarvester = await deployWithConfirmation("OETHHarvester", [
    cVaultProxy.address,
  ]);

  await withConfirmation(
    cHarvesterProxy.connect(sDeployer)[
      // eslint-disable-next-line
      "initialize(address,address,bytes)"
    ](dHarvester.address, deployerAddr, [])
  );

  const cHarvester = await ethers.getContractAt(
    "OETHHarvester",
    cHarvesterProxy.address
  );

  await withConfirmation(
    // CRV/ETH
    cOETHOracleRouter.cacheDecimals(addresses.mainnet.CRV)
  );

  await withConfirmation(
    // CVX/ETH
    cOETHOracleRouter.cacheDecimals(addresses.mainnet.CVX)
  );

  await withConfirmation(
    // rETH/ETH
    cOETHOracleRouter.cacheDecimals(addresses.mainnet.rETH)
  );

  await withConfirmation(
    // stETH/ETH
    cOETHOracleRouter.cacheDecimals(addresses.mainnet.stETH)
  );

  await withConfirmation(
    cHarvester.connect(sDeployer).transferGovernance(guardianAddr)
  );

  // Some of the harvester governance actions are executed when deploying Curve
  // strategy
  return {
    actions: [
      {
        contract: cHarvester,
        signature: "claimGovernance()",
        args: [],
      },
      {
        contract: cVault,
        signature: "setPriceProvider(address)",
        args: [cOETHOracleRouter.address],
      },
    ],
    cHarvester,
  };
};

// const reDeployOETH = async ({
//   deployWithConfirmation,
//   withConfirmation,
//   ethers,
// }) => {
//   const cOETHProxy = await ethers.getContract("OETHProxy");
//   const dOETH = await deployWithConfirmation("OETH");
//
//   return [
//     {
//       // Upgrade OETH proxy
//       contract: cOETHProxy,
//       signature: "upgradeTo(address)",
//       args: [dOETH.address],
//     }
//   ];
// };

// eslint-disable-next-line no-unused-vars
const deployCurve = async ({ withConfirmation, ethers }) => {
  if (isMainnet) {
    throw new Error("This shouldn't happen on the mainnet");
  }

  const { deployerAddr } = await getNamedAccounts();
  const sDeployer = await ethers.provider.getSigner(deployerAddr);
  const gaugeControllerAdmin = "0x40907540d8a6C65c637785e8f8B742ae6b0b9968";
  await impersonateAccount(gaugeControllerAdmin);
  const sGaugeControllerAdmin = await ethers.provider.getSigner(
    gaugeControllerAdmin
  );
  const cVaultProxy = await ethers.getContract("OETHVaultProxy");
  const cVault = await ethers.getContractAt(
    "OETHVaultCore",
    cVaultProxy.address
  );

  // prettier-ignore
  // const curveFactoryAbi = [{name: "CryptoPoolDeployed",inputs: [{ name: "token", type: "address", indexed: false },{ name: "coins", type: "address[2]", indexed: false },{ name: "A", type: "uint256", indexed: false },{ name: "gamma", type: "uint256", indexed: false },{ name: "mid_fee", type: "uint256", indexed: false },{ name: "out_fee", type: "uint256", indexed: false },{ name: "allowed_extra_profit", type: "uint256", indexed: false },{ name: "fee_gamma", type: "uint256", indexed: false },{ name: "adjustment_step", type: "uint256", indexed: false },{ name: "admin_fee", type: "uint256", indexed: false },{ name: "ma_half_time", type: "uint256", indexed: false },{ name: "initial_price", type: "uint256", indexed: false },{ name: "deployer", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "LiquidityGaugeDeployed",inputs: [{ name: "pool", type: "address", indexed: false },{ name: "token", type: "address", indexed: false },{ name: "gauge", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "UpdateFeeReceiver",inputs: [{ name: "_old_fee_receiver", type: "address", indexed: false },{ name: "_new_fee_receiver", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "UpdatePoolImplementation",inputs: [{ name: "_old_pool_implementation", type: "address", indexed: false },{ name: "_new_pool_implementation", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "UpdateTokenImplementation",inputs: [{ name: "_old_token_implementation", type: "address", indexed: false },{ name: "_new_token_implementation", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "UpdateGaugeImplementation",inputs: [{ name: "_old_gauge_implementation", type: "address", indexed: false },{ name: "_new_gauge_implementation", type: "address", indexed: false },],anonymous: false,type: "event",},{name: "TransferOwnership",inputs: [{ name: "_old_owner", type: "address", indexed: false },{ name: "_new_owner", type: "address", indexed: false },],anonymous: false,type: "event",},{stateMutability: "nonpayable",type: "constructor",inputs: [{ name: "_fee_receiver", type: "address" },{ name: "_pool_implementation", type: "address" },{ name: "_token_implementation", type: "address" },{ name: "_gauge_implementation", type: "address" },{ name: "_weth", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "deploy_pool",inputs: [{ name: "_name", type: "string" },{ name: "_symbol", type: "string" },{ name: "_coins", type: "address[2]" },{ name: "A", type: "uint256" },{ name: "gamma", type: "uint256" },{ name: "mid_fee", type: "uint256" },{ name: "out_fee", type: "uint256" },{ name: "allowed_extra_profit", type: "uint256" },{ name: "fee_gamma", type: "uint256" },{ name: "adjustment_step", type: "uint256" },{ name: "admin_fee", type: "uint256" },{ name: "ma_half_time", type: "uint256" },{ name: "initial_price", type: "uint256" },],outputs: [{ name: "", type: "address" }],},{stateMutability: "nonpayable",type: "function",name: "deploy_gauge",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "address" }],},{stateMutability: "nonpayable",type: "function",name: "set_fee_receiver",inputs: [{ name: "_fee_receiver", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "set_pool_implementation",inputs: [{ name: "_pool_implementation", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "set_token_implementation",inputs: [{ name: "_token_implementation", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "set_gauge_implementation",inputs: [{ name: "_gauge_implementation", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "commit_transfer_ownership",inputs: [{ name: "_addr", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "accept_transfer_ownership",inputs: [],outputs: [],},{stateMutability: "view",type: "function",name: "find_pool_for_coins",inputs: [{ name: "_from", type: "address" },{ name: "_to", type: "address" },],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "find_pool_for_coins",inputs: [{ name: "_from", type: "address" },{ name: "_to", type: "address" },{ name: "i", type: "uint256" },],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "get_coins",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "address[2]" }],},{stateMutability: "view",type: "function",name: "get_decimals",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "uint256[2]" }],},{stateMutability: "view",type: "function",name: "get_balances",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "uint256[2]" }],},{stateMutability: "view",type: "function",name: "get_coin_indices",inputs: [{ name: "_pool", type: "address" },{ name: "_from", type: "address" },{ name: "_to", type: "address" },],outputs: [{ name: "", type: "uint256" },{ name: "", type: "uint256" },],},{stateMutability: "view",type: "function",name: "get_gauge",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "get_eth_index",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "uint256" }],},{stateMutability: "view",type: "function",name: "get_token",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "admin",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "future_admin",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "fee_receiver",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "pool_implementation",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "token_implementation",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "gauge_implementation",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "pool_count",inputs: [],outputs: [{ name: "", type: "uint256" }],},{stateMutability: "view",type: "function",name: "pool_list",inputs: [{ name: "arg0", type: "uint256" }],outputs: [{ name: "", type: "address" }]}];
  // prettier-ignore
  const convexPoolManagerAbi = [{inputs: [{ internalType: "address", name: "_pools", type: "address" }],stateMutability: "nonpayable",type: "constructor",},{inputs: [{ internalType: "address", name: "_gauge", type: "address" },{ internalType: "uint256", name: "_stashVersion", type: "uint256" },],name: "addPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_gauge", type: "address" }],name: "addPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "", type: "address" }],name: "blockList",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "_lptoken", type: "address" },{ internalType: "address", name: "_gauge", type: "address" },{ internalType: "uint256", name: "_stashVersion", type: "uint256" },],name: "forceAddPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "gaugeController",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "operator",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "pools",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "postAddHook",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "_operator", type: "address" }],name: "setOperator",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_hook", type: "address" }],name: "setPostAddHook",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],name: "shutdownPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function"}];
  // prettier-ignore
  const curveGaugeFactoryAbi = [{name: "SetManager",inputs: [{ name: "_manager", type: "address", indexed: true }],anonymous: false,type: "event",},{name: "SetGaugeManager",inputs: [{ name: "_gauge", type: "address", indexed: true },{ name: "_gauge_manager", type: "address", indexed: true },],anonymous: false,type: "event",},{stateMutability: "nonpayable",type: "constructor",inputs: [{ name: "_factory", type: "address" },{ name: "_manager", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "add_reward",inputs: [{ name: "_gauge", type: "address" },{ name: "_reward_token", type: "address" },{ name: "_distributor", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "set_reward_distributor",inputs: [{ name: "_gauge", type: "address" },{ name: "_reward_token", type: "address" },{ name: "_distributor", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "deploy_gauge",inputs: [{ name: "_pool", type: "address" }],outputs: [{ name: "", type: "address" }],},{stateMutability: "nonpayable",type: "function",name: "deploy_gauge",inputs: [{ name: "_pool", type: "address" },{ name: "_gauge_manager", type: "address" },],outputs: [{ name: "", type: "address" }],},{stateMutability: "nonpayable",type: "function",name: "set_gauge_manager",inputs: [{ name: "_gauge", type: "address" },{ name: "_gauge_manager", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "set_manager",inputs: [{ name: "_manager", type: "address" }],outputs: [],},{stateMutability: "pure",type: "function",name: "factory",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "pure",type: "function",name: "owner_proxy",inputs: [],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "gauge_manager",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "address" }],},{stateMutability: "view",type: "function",name: "manager",inputs: [],outputs: [{ name: "", type: "address" }]}];
  // prettier-ignore
  // const curveGaugeAbi = [{name: "Deposit",inputs: [{ name: "provider", type: "address", indexed: true },{ name: "value", type: "uint256", indexed: false },],anonymous: false,type: "event",},{name: "Withdraw",inputs: [{ name: "provider", type: "address", indexed: true },{ name: "value", type: "uint256", indexed: false },],anonymous: false,type: "event",},{name: "UpdateLiquidityLimit",inputs: [{ name: "user", type: "address", indexed: false },{ name: "original_balance", type: "uint256", indexed: false },{ name: "original_supply", type: "uint256", indexed: false },{ name: "working_balance", type: "uint256", indexed: false },{ name: "working_supply", type: "uint256", indexed: false },],anonymous: false,type: "event",},{name: "CommitOwnership",inputs: [{ name: "admin", type: "address", indexed: false }],anonymous: false,type: "event",},{name: "ApplyOwnership",inputs: [{ name: "admin", type: "address", indexed: false }],anonymous: false,type: "event",},{name: "Transfer",inputs: [{ name: "_from", type: "address", indexed: true },{ name: "_to", type: "address", indexed: true },{ name: "_value", type: "uint256", indexed: false },],anonymous: false,type: "event",},{name: "Approval",inputs: [{ name: "_owner", type: "address", indexed: true },{ name: "_spender", type: "address", indexed: true },{ name: "_value", type: "uint256", indexed: false },],anonymous: false,type: "event",},{stateMutability: "nonpayable",type: "constructor",inputs: [],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "initialize",inputs: [{ name: "_lp_token", type: "address" }],outputs: [],gas: 374587,},{stateMutability: "view",type: "function",name: "decimals",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 318,},{stateMutability: "view",type: "function",name: "integrate_checkpoint",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 4590,},{stateMutability: "nonpayable",type: "function",name: "user_checkpoint",inputs: [{ name: "addr", type: "address" }],outputs: [{ name: "", type: "bool" }],gas: 3123886,},{stateMutability: "nonpayable",type: "function",name: "claimable_tokens",inputs: [{ name: "addr", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3038676,},{stateMutability: "view",type: "function",name: "claimed_reward",inputs: [{ name: "_addr", type: "address" },{ name: "_token", type: "address" },],outputs: [{ name: "", type: "uint256" }],gas: 3036,},{stateMutability: "view",type: "function",name: "claimable_reward",inputs: [{ name: "_user", type: "address" },{ name: "_reward_token", type: "address" },],outputs: [{ name: "", type: "uint256" }],gas: 20255,},{stateMutability: "nonpayable",type: "function",name: "set_rewards_receiver",inputs: [{ name: "_receiver", type: "address" }],outputs: [],gas: 35673,},{stateMutability: "nonpayable",type: "function",name: "claim_rewards",inputs: [],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "claim_rewards",inputs: [{ name: "_addr", type: "address" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "claim_rewards",inputs: [{ name: "_addr", type: "address" },{ name: "_receiver", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "kick",inputs: [{ name: "addr", type: "address" }],outputs: [],gas: 3137977,},{stateMutability: "nonpayable",type: "function",name: "deposit",inputs: [{ name: "_value", type: "uint256" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "deposit",inputs: [{ name: "_value", type: "uint256" },{ name: "_addr", type: "address" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "deposit",inputs: [{ name: "_value", type: "uint256" },{ name: "_addr", type: "address" },{ name: "_claim_rewards", type: "bool" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "withdraw",inputs: [{ name: "_value", type: "uint256" }],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "withdraw",inputs: [{ name: "_value", type: "uint256" },{ name: "_claim_rewards", type: "bool" },],outputs: [],},{stateMutability: "nonpayable",type: "function",name: "transfer",inputs: [{ name: "_to", type: "address" },{ name: "_value", type: "uint256" },],outputs: [{ name: "", type: "bool" }],gas: 18062826,},{stateMutability: "nonpayable",type: "function",name: "transferFrom",inputs: [{ name: "_from", type: "address" },{ name: "_to", type: "address" },{ name: "_value", type: "uint256" },],outputs: [{ name: "", type: "bool" }],gas: 18100776,},{stateMutability: "nonpayable",type: "function",name: "approve",inputs: [{ name: "_spender", type: "address" },{ name: "_value", type: "uint256" },],outputs: [{ name: "", type: "bool" }],gas: 38151,},{stateMutability: "nonpayable",type: "function",name: "increaseAllowance",inputs: [{ name: "_spender", type: "address" },{ name: "_added_value", type: "uint256" },],outputs: [{ name: "", type: "bool" }],gas: 40695,},{stateMutability: "nonpayable",type: "function",name: "decreaseAllowance",inputs: [{ name: "_spender", type: "address" },{ name: "_subtracted_value", type: "uint256" },],outputs: [{ name: "", type: "bool" }],gas: 40719,},{stateMutability: "nonpayable",type: "function",name: "add_reward",inputs: [{ name: "_reward_token", type: "address" },{ name: "_distributor", type: "address" },],outputs: [],gas: 115414,},{stateMutability: "nonpayable",type: "function",name: "set_reward_distributor",inputs: [{ name: "_reward_token", type: "address" },{ name: "_distributor", type: "address" },],outputs: [],gas: 43179,},{stateMutability: "nonpayable",type: "function",name: "deposit_reward_token",inputs: [{ name: "_reward_token", type: "address" },{ name: "_amount", type: "uint256" },],outputs: [],gas: 1540067,},{stateMutability: "nonpayable",type: "function",name: "set_killed",inputs: [{ name: "_is_killed", type: "bool" }],outputs: [],gas: 40529,},{stateMutability: "view",type: "function",name: "lp_token",inputs: [],outputs: [{ name: "", type: "address" }],gas: 3018,},{stateMutability: "view",type: "function",name: "future_epoch_time",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 3048,},{stateMutability: "view",type: "function",name: "balanceOf",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3293,},{stateMutability: "view",type: "function",name: "totalSupply",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 3108,},{stateMutability: "view",type: "function",name: "allowance",inputs: [{ name: "arg0", type: "address" },{ name: "arg1", type: "address" },],outputs: [{ name: "", type: "uint256" }],gas: 3568,},{stateMutability: "view",type: "function",name: "name",inputs: [],outputs: [{ name: "", type: "string" }],gas: 13398,},{stateMutability: "view",type: "function",name: "symbol",inputs: [],outputs: [{ name: "", type: "string" }],gas: 11151,},{stateMutability: "view",type: "function",name: "working_balances",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3443,},{stateMutability: "view",type: "function",name: "working_supply",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 3258,},{stateMutability: "view",type: "function",name: "period",inputs: [],outputs: [{ name: "", type: "int128" }],gas: 3288,},{stateMutability: "view",type: "function",name: "period_timestamp",inputs: [{ name: "arg0", type: "uint256" }],outputs: [{ name: "", type: "uint256" }],gas: 3363,},{stateMutability: "view",type: "function",name: "integrate_inv_supply",inputs: [{ name: "arg0", type: "uint256" }],outputs: [{ name: "", type: "uint256" }],gas: 3393,},{stateMutability: "view",type: "function",name: "integrate_inv_supply_of",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3593,},{stateMutability: "view",type: "function",name: "integrate_checkpoint_of",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3623,},{stateMutability: "view",type: "function",name: "integrate_fraction",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "uint256" }],gas: 3653,},{stateMutability: "view",type: "function",name: "inflation_rate",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 3468,},{stateMutability: "view",type: "function",name: "reward_count",inputs: [],outputs: [{ name: "", type: "uint256" }],gas: 3498,},{stateMutability: "view",type: "function",name: "reward_tokens",inputs: [{ name: "arg0", type: "uint256" }],outputs: [{ name: "", type: "address" }],gas: 3573,},{stateMutability: "view",type: "function",name: "reward_data",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "token", type: "address" },{ name: "distributor", type: "address" },{ name: "period_finish", type: "uint256" },{ name: "rate", type: "uint256" },{ name: "last_update", type: "uint256" },{ name: "integral", type: "uint256" },],gas: 15003,},{stateMutability: "view",type: "function",name: "rewards_receiver",inputs: [{ name: "arg0", type: "address" }],outputs: [{ name: "", type: "address" }],gas: 3803,},{stateMutability: "view",type: "function",name: "reward_integral_for",inputs: [{ name: "arg0", type: "address" },{ name: "arg1", type: "address" },],outputs: [{ name: "", type: "uint256" }],gas: 4048,},{stateMutability: "view",type: "function",name: "is_killed",inputs: [],outputs: [{ name: "", type: "bool" }],gas: 3648,},{stateMutability: "view",type: "function",name: "factory",inputs: [],outputs: [{ name: "", type: "address" }],gas: 3678,},];
  // prettier-ignore
  const gaugeControllerAbi = [{name: "CommitOwnership",inputs: [{ type: "address", name: "admin", indexed: false }],anonymous: false,type: "event",},{name: "ApplyOwnership",inputs: [{ type: "address", name: "admin", indexed: false }],anonymous: false,type: "event",},{name: "AddType",inputs: [{ type: "string", name: "name", indexed: false },{ type: "int128", name: "type_id", indexed: false },],anonymous: false,type: "event",},{name: "NewTypeWeight",inputs: [{ type: "int128", name: "type_id", indexed: false },{ type: "uint256", name: "time", indexed: false },{ type: "uint256", name: "weight", indexed: false },{ type: "uint256", name: "total_weight", indexed: false },],anonymous: false,type: "event",},{name: "NewGaugeWeight",inputs: [{ type: "address", name: "gauge_address", indexed: false },{ type: "uint256", name: "time", indexed: false },{ type: "uint256", name: "weight", indexed: false },{ type: "uint256", name: "total_weight", indexed: false },],anonymous: false,type: "event",},{name: "VoteForGauge",inputs: [{ type: "uint256", name: "time", indexed: false },{ type: "address", name: "user", indexed: false },{ type: "address", name: "gauge_addr", indexed: false },{ type: "uint256", name: "weight", indexed: false },],anonymous: false,type: "event",},{name: "NewGauge",inputs: [{ type: "address", name: "addr", indexed: false },{ type: "int128", name: "gauge_type", indexed: false },{ type: "uint256", name: "weight", indexed: false },],anonymous: false,type: "event",},{outputs: [],inputs: [{ type: "address", name: "_token" },{ type: "address", name: "_voting_escrow" },],stateMutability: "nonpayable",type: "constructor",},{name: "commit_transfer_ownership",outputs: [],inputs: [{ type: "address", name: "addr" }],stateMutability: "nonpayable",type: "function",gas: 37597,},{name: "apply_transfer_ownership",outputs: [],inputs: [],stateMutability: "nonpayable",type: "function",gas: 38497,},{name: "gauge_types",outputs: [{ type: "int128", name: "" }],inputs: [{ type: "address", name: "_addr" }],stateMutability: "view",type: "function",gas: 1625,},{name: "add_gauge",outputs: [],inputs: [{ type: "address", name: "addr" },{ type: "int128", name: "gauge_type" },],stateMutability: "nonpayable",type: "function",},{name: "add_gauge",outputs: [],inputs: [{ type: "address", name: "addr" },{ type: "int128", name: "gauge_type" },{ type: "uint256", name: "weight" },],stateMutability: "nonpayable",type: "function",},{name: "checkpoint",outputs: [],inputs: [],stateMutability: "nonpayable",type: "function",gas: 18033784416,},{name: "checkpoint_gauge",outputs: [],inputs: [{ type: "address", name: "addr" }],stateMutability: "nonpayable",type: "function",gas: 18087678795,},{name: "gauge_relative_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "addr" }],stateMutability: "view",type: "function",},{name: "gauge_relative_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "addr" },{ type: "uint256", name: "time" },],stateMutability: "view",type: "function",},{name: "gauge_relative_weight_write",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "addr" }],stateMutability: "nonpayable",type: "function",},{name: "gauge_relative_weight_write",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "addr" },{ type: "uint256", name: "time" },],stateMutability: "nonpayable",type: "function",},{name: "add_type",outputs: [],inputs: [{ type: "string", name: "_name" }],stateMutability: "nonpayable",type: "function",},{name: "add_type",outputs: [],inputs: [{ type: "string", name: "_name" },{ type: "uint256", name: "weight" },],stateMutability: "nonpayable",type: "function",},{name: "change_type_weight",outputs: [],inputs: [{ type: "int128", name: "type_id" },{ type: "uint256", name: "weight" },],stateMutability: "nonpayable",type: "function",gas: 36246310050,},{name: "change_gauge_weight",outputs: [],inputs: [{ type: "address", name: "addr" },{ type: "uint256", name: "weight" },],stateMutability: "nonpayable",type: "function",gas: 36354170809,},{name: "vote_for_gauge_weights",outputs: [],inputs: [{ type: "address", name: "_gauge_addr" },{ type: "uint256", name: "_user_weight" },],stateMutability: "nonpayable",type: "function",gas: 18142052127,},{name: "get_gauge_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "addr" }],stateMutability: "view",type: "function",gas: 2974,},{name: "get_type_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "int128", name: "type_id" }],stateMutability: "view",type: "function",gas: 2977,},{name: "get_total_weight",outputs: [{ type: "uint256", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 2693,},{name: "get_weights_sum_per_type",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "int128", name: "type_id" }],stateMutability: "view",type: "function",gas: 3109,},{name: "admin",outputs: [{ type: "address", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1841,},{name: "future_admin",outputs: [{ type: "address", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1871,},{name: "token",outputs: [{ type: "address", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1901,},{name: "voting_escrow",outputs: [{ type: "address", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1931,},{name: "n_gauge_types",outputs: [{ type: "int128", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1961,},{name: "n_gauges",outputs: [{ type: "int128", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 1991,},{name: "gauge_type_names",outputs: [{ type: "string", name: "" }],inputs: [{ type: "int128", name: "arg0" }],stateMutability: "view",type: "function",gas: 8628,},{name: "gauges",outputs: [{ type: "address", name: "" }],inputs: [{ type: "uint256", name: "arg0" }],stateMutability: "view",type: "function",gas: 2160,},{name: "vote_user_slopes",outputs: [{ type: "uint256", name: "slope" },{ type: "uint256", name: "power" },{ type: "uint256", name: "end" },],inputs: [{ type: "address", name: "arg0" },{ type: "address", name: "arg1" },],stateMutability: "view",type: "function",gas: 5020,},{name: "vote_user_power",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "arg0" }],stateMutability: "view",type: "function",gas: 2265,},{name: "last_user_vote",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "arg0" },{ type: "address", name: "arg1" },],stateMutability: "view",type: "function",gas: 2449,},{name: "points_weight",outputs: [{ type: "uint256", name: "bias" },{ type: "uint256", name: "slope" },],inputs: [{ type: "address", name: "arg0" },{ type: "uint256", name: "arg1" },],stateMutability: "view",type: "function",gas: 3859,},{name: "time_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "address", name: "arg0" }],stateMutability: "view",type: "function",gas: 2355,},{name: "points_sum",outputs: [{ type: "uint256", name: "bias" },{ type: "uint256", name: "slope" },],inputs: [{ type: "int128", name: "arg0" },{ type: "uint256", name: "arg1" },],stateMutability: "view",type: "function",gas: 3970,},{name: "time_sum",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "uint256", name: "arg0" }],stateMutability: "view",type: "function",gas: 2370,},{name: "points_total",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "uint256", name: "arg0" }],stateMutability: "view",type: "function",gas: 2406,},{name: "time_total",outputs: [{ type: "uint256", name: "" }],inputs: [],stateMutability: "view",type: "function",gas: 2321,},{name: "points_type_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "int128", name: "arg0" },{ type: "uint256", name: "arg1" },],stateMutability: "view",type: "function",gas: 2671,},{name: "time_type_weight",outputs: [{ type: "uint256", name: "" }],inputs: [{ type: "uint256", name: "arg0" }],stateMutability: "view",type: "function",gas: 2490,},];
  // prettier-ignore
  const erc20Abi = [{anonymous: false,inputs: [{indexed: true,internalType: "address",name: "owner",type: "address",},{indexed: true,internalType: "address",name: "spender",type: "address",},{indexed: false,internalType: "uint256",name: "value",type: "uint256",},],name: "Approval",type: "event",},{anonymous: false,inputs: [{indexed: true,internalType: "address",name: "from",type: "address",},{ indexed: true, internalType: "address", name: "to", type: "address" },{indexed: false,internalType: "uint256",name: "value",type: "uint256",},],name: "Transfer",type: "event",},{inputs: [{ internalType: "address", name: "owner", type: "address" },{ internalType: "address", name: "spender", type: "address" },],name: "allowance",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "spender", type: "address" },{ internalType: "uint256", name: "amount", type: "uint256" },],name: "approve",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "account", type: "address" }],name: "balanceOf",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "totalSupply",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "recipient", type: "address" },{ internalType: "uint256", name: "amount", type: "uint256" },],name: "transfer",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "sender", type: "address" },{ internalType: "address", name: "recipient", type: "address" },{ internalType: "uint256", name: "amount", type: "uint256" },],name: "transferFrom",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},];
  // prettier-ignore
  const curvePoolAbi = [{"name":"Transfer","inputs":[{"name":"sender","type":"address","indexed":true},{"name":"receiver","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"Approval","inputs":[{"name":"owner","type":"address","indexed":true},{"name":"spender","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"TokenExchange","inputs":[{"name":"buyer","type":"address","indexed":true},{"name":"sold_id","type":"int128","indexed":false},{"name":"tokens_sold","type":"uint256","indexed":false},{"name":"bought_id","type":"int128","indexed":false},{"name":"tokens_bought","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amount","type":"uint256","indexed":false},{"name":"coin_amount","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"name":"provider","type":"address","indexed":true},{"name":"token_amounts","type":"uint256[2]","indexed":false},{"name":"fees","type":"uint256[2]","indexed":false},{"name":"invariant","type":"uint256","indexed":false},{"name":"token_supply","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"name":"old_A","type":"uint256","indexed":false},{"name":"new_A","type":"uint256","indexed":false},{"name":"initial_time","type":"uint256","indexed":false},{"name":"future_time","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"name":"A","type":"uint256","indexed":false},{"name":"t","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"name":"new_fee","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"name":"ApplyNewFee","inputs":[{"name":"fee","type":"uint256","indexed":false}],"anonymous":false,"type":"event"},{"stateMutability":"nonpayable","type":"constructor","inputs":[],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"initialize","inputs":[{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_coins","type":"address[4]"},{"name":"_rate_multipliers","type":"uint256[4]"},{"name":"_A","type":"uint256"},{"name":"_fee","type":"uint256"}],"outputs":[]},{"stateMutability":"view","type":"function","name":"decimals","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"transfer","inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"nonpayable","type":"function","name":"transferFrom","inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"nonpayable","type":"function","name":"approve","inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"nonpayable","type":"function","name":"permit","inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"},{"name":"_deadline","type":"uint256"},{"name":"_v","type":"uint8"},{"name":"_r","type":"bytes32"},{"name":"_s","type":"bytes32"}],"outputs":[{"name":"","type":"bool"}]},{"stateMutability":"view","type":"function","name":"last_price","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"ema_price","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_balances","inputs":[],"outputs":[{"name":"","type":"uint256[2]"}]},{"stateMutability":"view","type":"function","name":"admin_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"A","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"A_precise","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_p","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"price_oracle","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_virtual_price","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_token_amount","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_is_deposit","type":"bool"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_min_mint_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"add_liquidity","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_min_mint_amount","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"get_dy","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"dx","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"payable","type":"function","name":"exchange","inputs":[{"name":"i","type":"int128"},{"name":"j","type":"int128"},{"name":"_dx","type":"uint256"},{"name":"_min_dy","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[2]"}],"outputs":[{"name":"","type":"uint256[2]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"_min_amounts","type":"uint256[2]"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256[2]"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_imbalance","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_max_burn_amount","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_imbalance","inputs":[{"name":"_amounts","type":"uint256[2]"},{"name":"_max_burn_amount","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"calc_withdraw_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"},{"name":"_min_received","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"remove_liquidity_one_coin","inputs":[{"name":"_burn_amount","type":"uint256"},{"name":"i","type":"int128"},{"name":"_min_received","type":"uint256"},{"name":"_receiver","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"ramp_A","inputs":[{"name":"_future_A","type":"uint256"},{"name":"_future_time","type":"uint256"}],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"stop_ramp_A","inputs":[],"outputs":[]},{"stateMutability":"view","type":"function","name":"admin_balances","inputs":[{"name":"i","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"nonpayable","type":"function","name":"withdraw_admin_fees","inputs":[],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"commit_new_fee","inputs":[{"name":"_new_fee","type":"uint256"}],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"apply_new_fee","inputs":[],"outputs":[]},{"stateMutability":"nonpayable","type":"function","name":"set_ma_exp_time","inputs":[{"name":"_ma_exp_time","type":"uint256"}],"outputs":[]},{"stateMutability":"view","type":"function","name":"version","inputs":[],"outputs":[{"name":"","type":"string"}]},{"stateMutability":"view","type":"function","name":"coins","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},{"stateMutability":"view","type":"function","name":"balances","inputs":[{"name":"arg0","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"fee","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"future_fee","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"admin_action_deadline","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"initial_A","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"future_A","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"initial_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"future_A_time","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"name","inputs":[],"outputs":[{"name":"","type":"string"}]},{"stateMutability":"view","type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string"}]},{"stateMutability":"view","type":"function","name":"balanceOf","inputs":[{"name":"arg0","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"allowance","inputs":[{"name":"arg0","type":"address"},{"name":"arg1","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"DOMAIN_SEPARATOR","inputs":[],"outputs":[{"name":"","type":"bytes32"}]},{"stateMutability":"view","type":"function","name":"nonces","inputs":[{"name":"arg0","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"ma_exp_time","inputs":[],"outputs":[{"name":"","type":"uint256"}]},{"stateMutability":"view","type":"function","name":"ma_last_time","inputs":[],"outputs":[{"name":"","type":"uint256"}]}];

  const cCurveGaugeFactory = new Contract(
    "0x9f99FDe2ED3997EAfE52b78E3981b349fD2Eb8C9",
    curveGaugeFactoryAbi,
    sDeployer
  );
  const cConvexPoolManager = new Contract(
    "0xc461E1CE3795Ee30bA2EC59843d5fAe14d5782D5",
    convexPoolManagerAbi,
    sDeployer
  );
  const gaugeController = new Contract(
    "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB",
    gaugeControllerAbi
  );

  const gaugeTx = await withConfirmation(
    cCurveGaugeFactory.connect(sDeployer)["deploy_gauge(address)"](poolAddress)
  );

  const gaugeAddress =
    "0x" + gaugeTx.receipt.logs[0].data.substr(2 + 64 * 2 + 24, 40);

  console.log("Gauge deployed to address: ", gaugeAddress);

  await withConfirmation(
    gaugeController.connect(sGaugeControllerAdmin)[
      // eslint-disable-next-line no-unexpected-multiline
      "add_gauge(address,int128)"
    ](gaugeAddress, 0)
  );

  await withConfirmation(
    gaugeController
      .connect(sGaugeControllerAdmin)
      .change_gauge_weight(gaugeAddress, 100, { gasLimit: 2000000 })
  );

  await withConfirmation(
    cConvexPoolManager.connect(sDeployer)["addPool(address)"](gaugeAddress)
  );

  // add liquidity to Curve pool otherwise multiple functions fail when called
  const oeth = new Contract(addresses.mainnet.OETHProxy, erc20Abi);
  const weth = new Contract(addresses.mainnet.WETH, erc20Abi);
  const reth = new Contract(addresses.mainnet.rETH, erc20Abi);
  const curvePool = new Contract(poolAddress, curvePoolAbi);
  const weth_whale = "0x44cc771fbe10dea3836f37918cf89368589b6316";
  const reth_whale = "0x5313b39bf226ced2332C81eB97BB28c6fD50d1a3";

  await impersonateAccount(weth_whale);
  const sWethWhale = await ethers.provider.getSigner(weth_whale);
  await impersonateAccount(reth_whale);
  const sRethWhale = await ethers.provider.getSigner(reth_whale);

  await reth
    .connect(sRethWhale)
    .approve(cVault.address, utils.parseUnits("1", 50));

  // mint a bunch of OETH so the tests don't trigger the 3% maxSupplyDiff on redeem
  const oethToMint = utils.parseUnits("4000", 18);
  await cVault.connect(sRethWhale).mint(reth.address, oethToMint, 0);
  await oeth.connect(sRethWhale).transfer(weth_whale, oethToMint);
  await oeth
    .connect(sRethWhale)
    .approve(sRethWhale.address, utils.parseUnits("1", 50));
  await oeth
    .connect(sRethWhale)
    .transferFrom(sRethWhale.address, weth_whale, oethToMint);

  await weth
    .connect(sWethWhale)
    .approve(poolAddress, utils.parseUnits("1", 50));
  await oeth
    .connect(sWethWhale)
    .approve(poolAddress, utils.parseUnits("1", 50));

  const depositValue = utils.parseUnits("50", 18);
  await curvePool.connect(sWethWhale)[
    // eslint-disable-next-line no-unexpected-multiline
    "add_liquidity(uint256[2],uint256)"
  ]([depositValue, depositValue], 0, {
    value: depositValue,
  });

  const tokenContract = new Contract(tokenAddress, erc20Abi);
  console.log(
    "LP RECEIVED:",
    (await tokenContract.connect(sWethWhale).balanceOf(weth_whale)).toString()
  );

  // find out the CVX booster PID
  // prettier-ignore
  // const cvxBoosterABI = [{inputs: [{ internalType: "address", name: "_staker", type: "address" },{ internalType: "address", name: "_minter", type: "address" },],stateMutability: "nonpayable",type: "constructor",},{anonymous: false,inputs: [{indexed: true,internalType: "address",name: "user",type: "address",},{indexed: true,internalType: "uint256",name: "poolid",type: "uint256",},{indexed: false,internalType: "uint256",name: "amount",type: "uint256",},],name: "Deposited",type: "event",},{anonymous: false,inputs: [{indexed: true,internalType: "address",name: "user",type: "address",},{indexed: true,internalType: "uint256",name: "poolid",type: "uint256",},{indexed: false,internalType: "uint256",name: "amount",type: "uint256",},],name: "Withdrawn",type: "event",},{inputs: [],name: "FEE_DENOMINATOR",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "MaxFees",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "_lptoken", type: "address" },{ internalType: "address", name: "_gauge", type: "address" },{ internalType: "uint256", name: "_stashVersion", type: "uint256" },],name: "addPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "address", name: "_gauge", type: "address" },],name: "claimRewards",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "crv",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "uint256", name: "_amount", type: "uint256" },{ internalType: "bool", name: "_stake", type: "bool" },],name: "deposit",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "bool", name: "_stake", type: "bool" },],name: "depositAll",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "distributionAddressId",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "earmarkFees",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "earmarkIncentive",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],name: "earmarkRewards",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "feeDistro",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "feeManager",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "feeToken",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "", type: "address" }],name: "gaugeMap",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "view",type: "function",},{inputs: [],name: "isShutdown",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "view",type: "function",},{inputs: [],name: "lockFees",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "lockIncentive",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "lockRewards",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "minter",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "owner",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "platformFee",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "", type: "uint256" }],name: "poolInfo",outputs: [{ internalType: "address", name: "lptoken", type: "address" },{ internalType: "address", name: "token", type: "address" },{ internalType: "address", name: "gauge", type: "address" },{ internalType: "address", name: "crvRewards", type: "address" },{ internalType: "address", name: "stash", type: "address" },{ internalType: "bool", name: "shutdown", type: "bool" },],stateMutability: "view",type: "function",},{inputs: [],name: "poolLength",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "poolManager",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "registry",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "rewardArbitrator",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "address", name: "_address", type: "address" },{ internalType: "uint256", name: "_amount", type: "uint256" },],name: "rewardClaimed",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "rewardFactory",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address", name: "_arb", type: "address" }],name: "setArbitrator",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_rfactory", type: "address" },{ internalType: "address", name: "_sfactory", type: "address" },{ internalType: "address", name: "_tfactory", type: "address" },],name: "setFactories",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "setFeeInfo",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_feeM", type: "address" }],name: "setFeeManager",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_lockFees", type: "uint256" },{ internalType: "uint256", name: "_stakerFees", type: "uint256" },{ internalType: "uint256", name: "_callerFees", type: "uint256" },{ internalType: "uint256", name: "_platform", type: "uint256" },],name: "setFees",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],name: "setGaugeRedirect",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_owner", type: "address" }],name: "setOwner",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_poolM", type: "address" }],name: "setPoolManager",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_rewards", type: "address" },{ internalType: "address", name: "_stakerRewards", type: "address" },],name: "setRewardContracts",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_treasury", type: "address" }],name: "setTreasury",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "address", name: "_voteDelegate", type: "address" },],name: "setVoteDelegate",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],name: "shutdownPool",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "shutdownSystem",outputs: [],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "staker",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "stakerIncentive",outputs: [{ internalType: "uint256", name: "", type: "uint256" }],stateMutability: "view",type: "function",},{inputs: [],name: "stakerRewards",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "stashFactory",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "tokenFactory",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "treasury",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "_voteId", type: "uint256" },{ internalType: "address", name: "_votingAddress", type: "address" },{ internalType: "bool", name: "_support", type: "bool" },],name: "vote",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "voteDelegate",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "address[]", name: "_gauge", type: "address[]" },{ internalType: "uint256[]", name: "_weight", type: "uint256[]" },],name: "voteGaugeWeight",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [],name: "voteOwnership",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [],name: "voteParameter",outputs: [{ internalType: "address", name: "", type: "address" }],stateMutability: "view",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "uint256", name: "_amount", type: "uint256" },],name: "withdraw",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" }],name: "withdrawAll",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},{inputs: [{ internalType: "uint256", name: "_pid", type: "uint256" },{ internalType: "uint256", name: "_amount", type: "uint256" },{ internalType: "address", name: "_to", type: "address" },],name: "withdrawTo",outputs: [{ internalType: "bool", name: "", type: "bool" }],stateMutability: "nonpayable",type: "function",},];
  // const cvxBooster = new Contract(addresses.mainnet.CVXBooster, cvxBoosterABI);

  return {
    actions: [],
  };
};
