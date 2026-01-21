const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");

const log = require("../utils/logger")("task:poolBooster");

// Contract addresses
const BRIBES_MODULE = addresses.mainnet.CurvePoolBoosterBribesModule;
const GAUGE_CONTROLLER = addresses.mainnet.CurveGaugeController;
const VE_CRV = addresses.mainnet.veCRV;
const CRV = addresses.mainnet.CRV;
const OETH_WETH_POOL = addresses.mainnet.curve.OETH_WETH.pool;
const OUSD_USDC_POOL = addresses.mainnet.curve.OUSD_USDC.pool;
const CRV_USD_ETH_CRV_POOL = addresses.mainnet.CurveTriPool;

// Reward token addresses
const OETH = addresses.mainnet.OETHProxy;
const OUSD = addresses.mainnet.OUSDProxy;

// Constants
const SECONDS_PER_WEEK = 60 * 60 * 24 * 7;

/**
 * Hardhat task to calculate and display the MaxPricePerVote for all Curve Pool Boosters
 */
async function calculateMaxPricePerVoteTask(taskArguments, hre) {
  const { ethers } = hre;
  const targetEfficiency = parseFloat(taskArguments.efficiency || "1");
  const skipRewardPerVote = taskArguments.skip || false;
  const output = taskArguments.output ? console.log : log;

  output(`\n=== Calculating MaxPricePerVote for Pool Boosters ===`);
  output(`BribesModule: ${BRIBES_MODULE}`);

  if (skipRewardPerVote) {
    output(`Mode: Skip RewardPerVote (array of zeros)\n`);
  } else {
    if (targetEfficiency <= 0 || targetEfficiency > 10) {
      throw new Error(
        `Invalid target efficiency: ${targetEfficiency}. Must be between 0 and 10.`
      );
    }
    output(`Target Efficiency: ${targetEfficiency * 100}%\n`);
  }

  // Minimal ABIs
  const bribesModuleAbi = [
    "function getPools() external view returns (address[])",
  ];
  const poolBoosterAbi = [
    "function rewardToken() external view returns (address)",
  ];
  const gaugeControllerAbi = [
    "function get_total_weight() view returns (uint256)",
  ];
  const veCRVAbi = ["function totalSupply() view returns (uint256)"];
  const crvAbi = ["function rate() view returns (uint256)"];
  const curvePool2Abi = [
    "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
  ];
  const curvePoolNGAbi = [
    "function get_dy(uint256 i, uint256 j, uint256 dx) view returns (uint256)",
  ];

  // Get contract instances
  const bribesModule = await ethers.getContractAt(
    bribesModuleAbi,
    BRIBES_MODULE
  );
  const gaugeController = await ethers.getContractAt(
    gaugeControllerAbi,
    GAUGE_CONTROLLER
  );
  const veCRVContract = await ethers.getContractAt(veCRVAbi, VE_CRV);
  const crvContract = await ethers.getContractAt(crvAbi, CRV);
  const oethPool = await ethers.getContractAt(curvePool2Abi, OETH_WETH_POOL);
  const ousdPool = await ethers.getContractAt(curvePoolNGAbi, OUSD_USDC_POOL);
  const triPool = await ethers.getContractAt(
    curvePoolNGAbi,
    CRV_USD_ETH_CRV_POOL
  );

  // Fetch pools from BribesModule
  const pools = await bribesModule.getPools();
  output(`Found ${pools.length} pools in BribesModule`);

  if (pools.length === 0) {
    output("No pools registered, nothing to calculate");
    return [];
  }

  // If skipping, just return array of zeros
  if (skipRewardPerVote) {
    const results = pools.map(() => parseUnits("0"));
    output(`Pools found: ${pools.length}`);
    pools.forEach((pool, i) => output(`  Pool ${i + 1}: ${pool}`));
    output(`\n=== SUMMARY ===`);
    output(`Rewards per vote array: [${results.map(() => "0").join(", ")}]`);
    output(`(RewardPerVote will be skipped for all pools)\n`);
    return results;
  }

  // Fetch on-chain data
  output("\n--- Fetching emission data ---");

  const [totalWeight, veCRVTotalSupply, crvRate, crvPriceInUsd, ethPriceInUsd] =
    await Promise.all([
      gaugeController.get_total_weight(),
      veCRVContract.totalSupply(),
      crvContract.rate(),
      triPool["get_dy(uint256,uint256,uint256)"](2, 0, parseUnits("1")),
      triPool["get_dy(uint256,uint256,uint256)"](1, 0, parseUnits("1")),
    ]);

  output(
    `GaugeController.get_total_weight() (36 decimals): ${formatUnits(
      totalWeight,
      36
    )}`
  );
  output(`veCRV.totalSupply(): ${formatUnits(veCRVTotalSupply, 18)}`);
  output(`CRV.rate() (per second): ${formatUnits(crvRate, 18)}`);
  output(`CRV price in USD: ${formatUnits(crvPriceInUsd, 18)}`);
  output(`ETH price in USD: ${formatUnits(ethPriceInUsd, 18)}`);

  // Calculate emission data
  const emissionPerWeek = crvRate.mul(SECONDS_PER_WEEK);
  const voterPercentScaled = totalWeight.div(veCRVTotalSupply);
  const emissionValuePerVote = emissionPerWeek
    .mul(crvPriceInUsd)
    .mul(parseUnits("1", 18))
    .div(totalWeight);

  output(`\n--- Calculated Emission Data ---`);
  output(`CRV Emission per week: ${formatUnits(emissionPerWeek, 18)} CRV`);
  output(
    `Voter Percent (TotalWeight/veCRVSupply): ${formatUnits(
      voterPercentScaled.mul(100),
      18
    )}%`
  );
  output(
    `Emission Value per Vote: ${formatUnits(emissionValuePerVote, 18)} USD`
  );

  // Fetch token prices
  output(`\n--- Token Prices ---`);
  const oethPriceInEth = await oethPool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1")
  );
  const oethPriceInUsd = oethPriceInEth
    .mul(ethPriceInUsd)
    .div(parseUnits("1", 18));
  output(`OETH price in ETH: ${formatUnits(oethPriceInEth, 18)}`);
  output(`OETH price in USD: ${formatUnits(oethPriceInUsd, 18)}`);

  const ousdPriceInUsdc = await ousdPool["get_dy(uint256,uint256,uint256)"](
    0,
    1,
    parseUnits("1")
  );
  const ousdPriceInUsd = ousdPriceInUsdc.mul(parseUnits("1", 12)); // Scale 6 decimals to 18
  output(`OUSD price in USD: ${formatUnits(ousdPriceInUsd, 18)}`);

  // Calculate maxPricePerVote for each pool
  const results = [];
  const targetEfficiencyScaled = parseUnits(targetEfficiency.toString(), 18);

  output(`\n--- Pool Results ---`);

  for (let i = 0; i < pools.length; i++) {
    const poolAddress = pools[i];
    const poolBooster = await ethers.getContractAt(poolBoosterAbi, poolAddress);
    const rewardToken = await poolBooster.rewardToken();

    let rewardTokenSymbol;
    let rewardTokenPriceInUsd;

    if (rewardToken.toLowerCase() === OETH.toLowerCase()) {
      rewardTokenSymbol = "OETH";
      rewardTokenPriceInUsd = oethPriceInUsd;
    } else if (rewardToken.toLowerCase() === OUSD.toLowerCase()) {
      rewardTokenSymbol = "OUSD";
      rewardTokenPriceInUsd = ousdPriceInUsd;
    } else {
      output(
        `Pool ${i + 1}: ${poolAddress} - Unknown reward token: ${rewardToken}`
      );
      results.push(parseUnits("0"));
      continue;
    }

    const maxPricePerVote = emissionValuePerVote
      .mul(parseUnits("1", 18))
      .div(
        rewardTokenPriceInUsd
          .mul(targetEfficiencyScaled)
          .div(parseUnits("1", 18))
      );

    output(`Pool ${i + 1}: ${poolAddress}`);
    output(`  Reward Token: ${rewardTokenSymbol} (${rewardToken})`);
    output(
      `  Max Price Per Vote: ${formatUnits(
        maxPricePerVote,
        18
      )} ${rewardTokenSymbol}`
    );

    results.push(maxPricePerVote);
  }

  output(`\n=== SUMMARY ===`);
  output(
    `Rewards per vote array: [${results
      .map((r) => formatUnits(r, 18))
      .join(", ")}]`
  );
  output(`(with ${targetEfficiency * 100}% target efficiency)\n`);

  return results;
}

module.exports = {
  calculateMaxPricePerVoteTask,
};
