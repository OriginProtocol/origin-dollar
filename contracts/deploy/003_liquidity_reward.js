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

  await Promise.all(['USDT', 'USDC', 'DAI'].map(async stablecoin => {
    if (!isMainnet && !isGanacheFork) {
      // Mock Uniswap pair for OUSD -> USDT is dependent on OUSD being deployed
      const cOUSDProxy = await ethers.getContract("OUSDProxy");

      const reserve100OUSD = utils.parseUnits("100", 18);
      const reserve100STABLECOIN = utils.parseUnits("100", stablecoin === 'DAI' ? 18 : 6);

      let d = await deploy(`MockUniswapPairOUSD_${stablecoin}`, {
        from: deployerAddr,
        contract: "MockMintableUniswapPair",
        args: [
          cOUSDProxy.address,
          assetAddresses[stablecoin],
          reserve100OUSD,
          reserve100STABLECOIN,
        ],
      });

      await ethers.provider.waitForTransaction(
        d.receipt.transactionHash,
        NUM_CONFIRMATIONS
      );

      log(`Deployed Uniswap OUSD-${stablecoin} pair`, d);
    }

    const UniswapOUSD_STABLECOIN =
      isMainnet || isGanacheFork
        ? addresses.mainnet[`uniswapOUSD_${stablecoin}`]
        : (await ethers.getContract(`MockUniswapPairOUSD_${stablecoin}`)).address;

    const sDeployer = ethers.provider.getSigner(deployerAddr);
    const sGovernor = ethers.provider.getSigner(governorAddr);

    // Deploy the liquidity reward proxy.
    let d = await deploy(`LiquidityRewardOUSD_${stablecoin}Proxy`, {
      contract: "InitializeGovernedUpgradeabilityProxy",
      from: deployerAddr,
    });

    await ethers.provider.waitForTransaction(
      d.receipt.transactionHash,
      NUM_CONFIRMATIONS
    );

    log(`Deployed LiquidityRewardProxy for ${stablecoin}`, d);

    // Deploy the liquidityReward.
    const dLiquidityReward = await deploy("LiquidityReward", {
      from: deployerAddr,
    });
    
    await ethers.provider.waitForTransaction(
      dLiquidityReward.receipt.transactionHash,
      NUM_CONFIRMATIONS
    );
    log(`Deployed LiqudityReward for ${stablecoin}`, dLiquidityReward);

    // Initialize the proxy.
    const cLiquidityRewardOUSD_STABLECOINProxy = await ethers.getContract(
      `LiquidityRewardOUSD_${stablecoin}Proxy`
    );
    let t = await cLiquidityRewardOUSD_STABLECOINProxy[
      "initialize(address,address,bytes)"
    ](dLiquidityReward.address, deployerAddr, []);
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log(`Initialized LiquidityRewardProxy for ${stablecoin}`);

    // Initialize the LquidityReward
    const cLiquidityRewardOUSD_STABLECOIN = await ethers.getContractAt(
      "LiquidityReward",
      cLiquidityRewardOUSD_STABLECOINProxy.address
    );

    console.log("OGN Asset address:", assetAddresses.OGN);
    t = await cLiquidityRewardOUSD_STABLECOIN
      .connect(sDeployer)
      .initialize(assetAddresses.OGN, UniswapOUSD_STABLECOIN);
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log(`Initialized LiquidRewardStrategy for ${stablecoin}`);

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

    t = await cLiquidityRewardOUSD_STABLECOIN
      .connect(sDeployer)
      .transferGovernance(strategyGovAddr);
    await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
    log(`LiquidReward transferGovernance(${strategyGovAddr} called for ${stablecoin}`);

    if (!isMainnetOrRinkebyOrFork) {
      t = await cLiquidityRewardOUSD_STABLECOIN
        .connect(sGovernor) // Claim governance with governor
        .claimGovernance();
      await ethers.provider.waitForTransaction(t.hash, NUM_CONFIRMATIONS);
      log(`Claimed governance for LiquidityReward for ${stablecoin}`);

      const ogn = await ethers.getContract("MockOGN");
      const loadAmount = utils.parseUnits("7200000", 18);
      const rate = utils.parseUnits("6.1538461538", 18);
      await ogn.connect(sGovernor).mint(loadAmount);
      await ogn
        .connect(sGovernor)
        .transfer(cLiquidityRewardOUSD_STABLECOIN.address, loadAmount);

      await cLiquidityRewardOUSD_STABLECOIN
        .connect(sGovernor)
        .startCampaign(rate, 0, 6500 * 180);
    }
  }))


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
