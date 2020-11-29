const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
  isGanacheFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");
const { utils } = require("ethers");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

//
// 1. Deploy new Liquidity Reward contract
//
const liquidityReward = async ({ getNamedAccounts, deployments }) => {
  console.log("Running 003_liquidity_reward deployment...");

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);

  if (!isMainnet && !isGanacheFork) {
    // Mock Uniswap pair for OUSD -> USDT is dependent on OUSD being deployed
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    const reserve100OUSD = utils.parseUnits("100", 18);
    const reserve100USDT = utils.parseUnits("100", 6);

    let d = await deploy("MockUniswapPairOUSD_USDT", {
      from: deployerAddr,
      contract: "MockMintableUniswapPair",
      args: [
        cOUSDProxy.address,
        assetAddresses.USDT,
        reserve100OUSD,
        reserve100USDT,
      ],
    });

    await ethers.provider.waitForTransaction(
      d.receipt.transactionHash,
      NUM_CONFIRMATIONS
    );

    log("Deployed Uniswap OUSD-USDT pair", d);
  }

  const UniswapOUSD_USDT =
    isMainnet || isGanacheFork
      ? addresses.mainnet.uniswapOUSD_USDT
      : (await ethers.getContract("MockUniswapPairOUSD_USDT")).address;

  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy the liquidity reward proxy.
  let d = await deploy("LiquidityRewardOUSD_USDTProxy", {
    contract: "InitializeGovernedUpgradeabilityProxy",
    from: deployerAddr,
  });

  await ethers.provider.waitForTransaction(
    d.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed LiquidityRewardProxy", d);

  // Deploy the liquidityReward.
  const dLiquidityReward = await deploy("LiquidityReward", {
    from: deployerAddr,
  });
  await ethers.provider.waitForTransaction(
    dLiquidityReward.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed LiqudityReward", dLiquidityReward);

  // Initialize the proxy.
  const cLiquidityRewardOUSD_USDTProxy = await ethers.getContract(
    "LiquidityRewardOUSD_USDTProxy"
  );
  let t = await cLiquidityRewardOUSD_USDTProxy[
    "initialize(address,address,bytes)"
  ](dLiquidityReward.address, deployerAddr, []);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log("Initialized LiquidityRewardProxy");

  // Initialize the LquidityReward
  // Note: we are only doing DAI with Aave.
  const cLiquidityRewardOUSD_USDT = await ethers.getContractAt(
    "LiquidityReward",
    cLiquidityRewardOUSD_USDTProxy.address
  );

  console.log("OGN Asset address:", assetAddresses.OGN);
  t = await cLiquidityRewardOUSD_USDT
    .connect(sDeployer)
    .initialize(assetAddresses.OGN, UniswapOUSD_USDT);
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
    .transferGovernance(strategyGovAddr);
  await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
  log(`LiquidReward transferGovernance(${strategyGovAddr} called`);

  if (!isMainnetOrRinkebyOrFork) {
    t = await cLiquidityRewardOUSD_USDT
      .connect(sGovernor) // Claim governance with governor
      .claimGovernance();
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log("Claimed governance for LiquidityReward");

    const ogn = await ethers.getContract("MockOGN");
    const loadAmount = utils.parseUnits("7200000", 18);
    const rate = utils.parseUnits("6.1538461538", 18);
    await ogn.connect(sGovernor).mint(loadAmount);
    await ogn
      .connect(sGovernor)
      .transfer(cLiquidityRewardOUSD_USDT.address, loadAmount);

    await cLiquidityRewardOUSD_USDT
      .connect(sGovernor)
      .startCampaign(rate, 0, 6500 * 180);
  }

  // For mainnet we'd want to transfer OGN to the contract and then start the campaign
  // The Reward rate should start out as:
  //      18,000,000 OGN (<- totalRewards passed in)
  //       ÷ 6,500 blocks per day
  //       ÷ 180 days in the campaign
  //       ⨉ 40% weight for the OUSD/OGN pool
  //        = 6.153846153846154 OGN per block
  // Remember to transafer in:
  //     18,000,000 * 40% = 7,200,000
  //
  //  So starting the campaign would look like:
  //  await cLiquidityRewardOUSD_USDT
  //    .connect(sGovernor).startCampaign(
  //        utils.parseUnits("6.153846153846154", 18),
  //        0, 6500 * 180);
  //

  console.log("003_liquidity_reward deploy done.");

  return true;
};

liquidityReward.id = "003_liquidity_reward";
liquidityReward.dependencies = ["core"];

module.exports = liquidityReward;
