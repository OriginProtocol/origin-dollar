const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");
const { getTxOpts } = require("../utils/tx");
const { utils } = require("ethers");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

//
// 1. Deploy new Liquidity Reward contract
//
const liquidityReward = async ({
  getNamedAccounts,
  deployments,
}) => {
  console.log("Running 019_liquidity_reward deployment...");

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  if (!isMainnet) {
    // Mock Uniswap pair for OUSD -> USDT is dependent on OUSD being deployed
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    const reserve100OUSD = utils.parseUnits("100", 18);
    const reserve100USDT = utils.parseUnits("100", 6);

    let d = await deploy("MockUniswapPairOUSD_USDT", {
      from: deployerAddr,
      contract: "MockMintableUniswapPair",
      args: [cOUSDProxy.address, assetAddresses.USDT, reserve100OUSD, reserve100USDT],
    });

    await ethers.provider.waitForTransaction(
      d.receipt.transactionHash,
      NUM_CONFIRMATIONS
    );

    log("Deployed Uniswap OUSD-USDT pair", d);
  }

  const UniswapOUSD_USDT = isMainnet ? addresses.mainnet.uniswapOUSD_USDT : (await ethers.getContract("MockUniswapPairOUSD_USDT")).address;

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy the liquidity reward proxy.
  let d = await deploy("LiquidityRewardOUSD_USDTProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
    from: deployerAddr,
    ...(await getTxOpts()),
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed LiquidityRewardProxy", d);

  // Deploy the liquidityReward.
  const dLiquidityReward = await deploy("LiquidityReward", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dLiquidityReward.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed LiqudityReward", dLiquidityReward);

  // Initialize the proxy.
  const cLiquidityRewardOUSD_USDTProxy = await ethers.getContract("LiquidityRewardOUSD_USDTProxy");
  let t = await cLiquidityRewardOUSD_USDTProxy["initialize(address,address,bytes)"](
    dLiquidityReward.address,
    deployerAddr,
    [],
    await getTxOpts()
  );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized LiquidityRewardProxy");

  // Initialize the LquidityReward
  // Note: we are only doing DAI with Aave.
  const cLiquidityRewardOUSD_USDT = await ethers.getContractAt(
    "LiquidityReward",
    cLiquidityRewardOUSD_USDTProxy.address
  );

  t = await cLiquidityRewardOUSD_USDT.connect(sDeployer).initialize(
    assetAddresses.OGN,
    UniswapOUSD_USDT,
    await getTxOpts()
  );
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized LiquidRewardStrategy");

  
  //
  // Transfer governance of the Reward proxy to the governor
  //  - On Mainnet the governance transfer gets executed separately, via the multi-sig wallet.
  //  - On other networks, this migration script can claim governance by the governor.
  //
  let strategyGovAddr;
  if (isMainnet) {
    // On Mainnet the governor is the TimeLock
    strategyGovAddr = (await ethers.getContract("MinuteTimelock")).address;
  } else {
    strategyGovAddr = governorAddr;
  }

  t = await cLiquidityRewardOUSD_USDT
    .connect(sDeployer)
    .transferGovernance(strategyGovAddr, await getTxOpts());
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log(`LiquidReward transferGovernance(${strategyGovAddr} called`);


  if (!isMainnet) {
    t = await cLiquidityRewardOUSD_USDT
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance(await getTxOpts());
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Claimed governance for LiquidityReward");
  }

  // For mainnet we'd want to transfer OGN to the contract and then start the campaign
  // The Reward rate should start out as:
  //      18,000,000 OGN (<- totalRewards passed in)
  //       ÷ 6,500 blocks per day
  //       ÷ 180 days in the campaign
  //       ⨉ 40% weight for the OUSD/OGN pool
  //        = 5.384615384615385 OGN per block
  //
  //  So starting the campaign would look like:
  //  await cLiquidityRewardOUSD_USDT
  //    .connect(sGovernor).startCampaign(
  //        utils.parseUnits("5.384615384615385", 18),
  //        0, 6500 * 180);
  //

  console.log(
    "019_liquidity_reward deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

liquidityReward.dependencies = ["core"];

module.exports = liquidityReward;
