const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { Contract } = require("ethers");

const addresses = require("../utils/addresses");
const { logTxDetails } = require("../utils/txLogger");
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

// Minimal ABIs
const bribesModuleAbi = [
  "function getPoolBoosters() external view returns (address[])",
  "function manageBribes() external",
  "function manageBribes(uint256[] totalRewardAmounts, uint8[] extraDuration, uint256[] rewardsPerVote) external",
];

const poolBoosterAbi = [
  "function rewardToken() external view returns (address)",
  "function gauge() external view returns (address)",
];

const gaugeAbi = ["function lp_token() external view returns (address)"];

const lpTokenAbi = ["function name() external view returns (string)"];

const gaugeControllerAbi = [
  "function get_total_weight() external view returns (uint256)",
];

const veCRVAbi = ["function totalSupply() external view returns (uint256)"];

const crvAbi = ["function rate() external view returns (uint256)"];

// Curve pool ABIs for price queries
const curvePoolInt128Abi = [
  "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)",
];

const curvePoolUint256Abi = [
  "function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256)",
];

/**
 * Get OETH price in ETH from the OETH/WETH Curve pool
 * Pool composition: 0 = ETH, 1 = OETH
 */
async function getOETHPriceInETH(provider) {
  const pool = new Contract(OETH_WETH_POOL, curvePoolInt128Abi, provider);
  return await pool["get_dy(int128,int128,uint256)"](
    1, // from OETH
    0, // to ETH
    parseUnits("1", 18)
  );
}

/**
 * Get OUSD price in USD from the OUSD/USDC Curve pool
 * Pool composition: 0 = OUSD, 1 = USDC
 */
async function getOUSDPriceInUSD(provider) {
  const pool = new Contract(OUSD_USDC_POOL, curvePoolInt128Abi, provider);
  const ousdPriceInUsdc = await pool["get_dy(int128,int128,uint256)"](
    0, // from OUSD
    1, // to USDC
    parseUnits("1", 18)
  );
  // Scale from 6 decimals to 18 decimals
  return ousdPriceInUsdc.mul(parseUnits("1", 12));
}

/**
 * Get CRV price in USD from the crvUSD/ETH/CRV tricrypto pool
 * Pool composition: 0 = crvUSD, 1 = ETH, 2 = CRV
 */
async function getCRVPriceInUSD(provider) {
  const pool = new Contract(
    CRV_USD_ETH_CRV_POOL,
    curvePoolUint256Abi,
    provider
  );
  return await pool["get_dy(uint256,uint256,uint256)"](
    2, // from CRV
    0, // to crvUSD
    parseUnits("1", 18)
  );
}

/**
 * Get ETH price in USD from the crvUSD/ETH/CRV tricrypto pool
 * Pool composition: 0 = crvUSD, 1 = ETH, 2 = CRV
 */
async function getETHPriceInUSD(provider) {
  const pool = new Contract(
    CRV_USD_ETH_CRV_POOL,
    curvePoolUint256Abi,
    provider
  );
  return await pool["get_dy(uint256,uint256,uint256)"](
    1, // from ETH
    0, // to crvUSD
    parseUnits("1", 18)
  );
}

/**
 * Fetch CRV emission data needed for price calculation
 */
async function fetchEmissionData(provider, output) {
  const gaugeController = new Contract(
    GAUGE_CONTROLLER,
    gaugeControllerAbi,
    provider
  );
  const veCRV = new Contract(VE_CRV, veCRVAbi, provider);
  const crv = new Contract(CRV, crvAbi, provider);

  const [totalWeight, veCRVTotalSupply, crvRate, crvPriceInUsd] =
    await Promise.all([
      gaugeController.get_total_weight(),
      veCRV.totalSupply(),
      crv.rate(),
      getCRVPriceInUSD(provider),
    ]);

  output(`Total Weight (36 decimals): ${formatUnits(totalWeight, 36)}`);
  output(`veCRV Total Supply: ${formatUnits(veCRVTotalSupply, 18)}`);
  output(`CRV Rate (per second): ${formatUnits(crvRate, 18)}`);
  output(`CRV price in USD: ${formatUnits(crvPriceInUsd, 18)}`);

  const emissionPerWeek = crvRate.mul(SECONDS_PER_WEEK);
  output(`CRV Emission per week: ${formatUnits(emissionPerWeek, 18)}`);

  const voterPercentScaled = totalWeight.div(veCRVTotalSupply);
  output(
    `Voter Percent (scaled 1e18 = 100%): ${formatUnits(voterPercentScaled, 18)}`
  );

  return { totalWeight, veCRVTotalSupply, emissionPerWeek, crvPriceInUsd };
}

/**
 * Calculate EmissionValuePerVote in USD
 */
function calculateEmissionValuePerVote(
  emissionPerWeek,
  crvPriceInUsd,
  totalWeight,
  output
) {
  const emissionValuePerVote = emissionPerWeek
    .mul(crvPriceInUsd)
    .mul(parseUnits("1", 18))
    .div(totalWeight);
  output(
    `Emission Value per Vote (USD): ${formatUnits(emissionValuePerVote, 18)}`
  );
  return emissionValuePerVote;
}

/**
 * Calculate MaxPricePerVote for a given reward token price
 */
function calculateMaxPricePerVote(
  emissionValuePerVote,
  rewardTokenPriceInUsd,
  targetEfficiency
) {
  const targetEfficiencyScaled = parseUnits(targetEfficiency.toString(), 18);

  return emissionValuePerVote
    .mul(parseUnits("1", 18))
    .div(
      rewardTokenPriceInUsd.mul(targetEfficiencyScaled).div(parseUnits("1", 18))
    );
}

/**
 * Get the price of a reward token in USD
 */
async function getRewardTokenPrice(
  rewardToken,
  provider,
  ethPriceInUsd,
  output
) {
  const rewardTokenLower = rewardToken.toLowerCase().trim();
  const oethLower = OETH.toLowerCase().trim();
  const ousdLower = OUSD.toLowerCase().trim();

  if (rewardTokenLower === oethLower) {
    const oethPriceInEth = await getOETHPriceInETH(provider);
    const oethPriceInUsd = oethPriceInEth
      .mul(ethPriceInUsd)
      .div(parseUnits("1", 18));
    output(`OETH price in ETH: ${formatUnits(oethPriceInEth, 18)}`);
    output(`OETH price in USD: ${formatUnits(oethPriceInUsd, 18)}`);
    return { priceInUsd: oethPriceInUsd, symbol: "OETH" };
  } else if (rewardTokenLower === ousdLower) {
    const ousdPriceInUsd = await getOUSDPriceInUSD(provider);
    output(`OUSD price in USD: ${formatUnits(ousdPriceInUsd, 18)}`);
    return { priceInUsd: ousdPriceInUsd, symbol: "OUSD" };
  } else {
    throw new Error(`Unknown reward token: ${rewardToken}`);
  }
}

/**
 * Calculate rewards per vote for all pools in the BribesModule
 * @param {ethers.providers.Provider} provider
 * @param {Object} options
 * @param {number} options.targetEfficiency - Target efficiency (e.g., 1 for 100%)
 * @param {boolean} options.skipRewardPerVote - If true, returns array of zeros
 * @param {Function} options.log - Logger function
 * @returns {Promise<{pools: string[], rewardsPerVote: BigNumber[]}>}
 */
async function calculateRewardsPerVote(provider, options = {}) {
  const {
    targetEfficiency = 1,
    skipRewardPerVote = false,
    log: output = console.log,
  } = options;

  output(`\n=== Calculating MaxPricePerVote for Pool Boosters ===`);
  output(`BribesModule: ${BRIBES_MODULE}`);

  // Fetch pools from BribesModule
  const bribesModule = new Contract(BRIBES_MODULE, bribesModuleAbi, provider);
  const pools = await bribesModule.getPoolBoosters();
  output(`Found ${pools.length} pool boosters in BribesModule`);

  if (pools.length === 0) {
    output("No pool boosters registered, nothing to calculate");
    return { pools: [], rewardsPerVote: [] };
  }

  // Display gauge names for each pool
  for (let i = 0; i < pools.length; i++) {
    const poolAddress = pools[i];
    if (poolAddress === addresses.zero) continue;

    const poolBooster = new Contract(poolAddress, poolBoosterAbi, provider);
    const gaugeAddress = await poolBooster.gauge();
    const gauge = new Contract(gaugeAddress, gaugeAbi, provider);
    const lpTokenAddress = await gauge.lp_token();
    const lpToken = new Contract(lpTokenAddress, lpTokenAbi, provider);
    const lpTokenName = await lpToken.name();
    output(`  Pool ${i + 1} (${poolAddress}) - LP: ${lpTokenName}`);
  }

  // If skipping, return array of zeros
  if (skipRewardPerVote) {
    output(`Mode: Skip RewardPerVote (array of zeros)\n`);
    const rewardsPerVote = pools.map(() => parseUnits("0"));
    pools.forEach((pool, i) => output(`  Pool ${i + 1}: ${pool}`));
    output(`\n=== SUMMARY ===`);
    output(
      `Rewards per vote array: [${rewardsPerVote.map(() => "0").join(", ")}]`
    );
    output(`(RewardPerVote will be skipped for all pools)\n`);
    return { pools, rewardsPerVote };
  }

  // Validate target efficiency
  if (targetEfficiency <= 0 || targetEfficiency > 10) {
    throw new Error(
      `Invalid target efficiency: ${targetEfficiency}. Must be between 0 and 10.`
    );
  }
  output(`Target Efficiency: ${targetEfficiency * 100}%\n`);

  // Fetch emission data
  output(`--- Fetching emission data ---`);
  const { totalWeight, emissionPerWeek, crvPriceInUsd } =
    await fetchEmissionData(provider, output);
  const emissionValuePerVote = calculateEmissionValuePerVote(
    emissionPerWeek,
    crvPriceInUsd,
    totalWeight,
    output
  );

  // Fetch ETH price (needed for OETH price calculation)
  const ethPriceInUsd = await getETHPriceInUSD(provider);
  output(`ETH price in USD: ${formatUnits(ethPriceInUsd, 18)}`);

  // Calculate maxPricePerVote for each pool
  const rewardsPerVote = [];
  output(`\n--- Pool Results ---`);

  for (let i = 0; i < pools.length; i++) {
    const poolAddress = pools[i];
    // Get reward token and LP token name for this pool
    const poolBooster = new Contract(poolAddress, poolBoosterAbi, provider);
    const gaugeAddress = await poolBooster.gauge();
    const gauge = new Contract(gaugeAddress, gaugeAbi, provider);
    const lpTokenAddress = await gauge.lp_token();
    const lpToken = new Contract(lpTokenAddress, lpTokenAbi, provider);
    const lpTokenName = await lpToken.name();
    output(`\nPool Booster ${i + 1}:\t ${poolAddress}`);
    output(`Gauge:\t\t ${gaugeAddress}`);
    output(`Pool:\t\t ${lpTokenAddress} (${lpTokenName})`);

    const rewardToken = await poolBooster.rewardToken();

    try {
      const { priceInUsd: rewardTokenPriceInUsd, symbol } =
        await getRewardTokenPrice(rewardToken, provider, ethPriceInUsd, output);

      const maxPricePerVote = calculateMaxPricePerVote(
        emissionValuePerVote,
        rewardTokenPriceInUsd,
        targetEfficiency
      );

      output(`  Reward Token: ${symbol} (${rewardToken})`);
      output(
        `  Max Price Per Vote: ${formatUnits(maxPricePerVote, 18)} ${symbol}`
      );

      rewardsPerVote.push(maxPricePerVote);
    } catch (error) {
      output(`  Error: ${error.message}`);
      rewardsPerVote.push(parseUnits("0"));
    }
  }

  output(`\n=== SUMMARY ===`);
  output(
    `Rewards per vote array: [${rewardsPerVote
      .map((r) => formatUnits(r, 18))
      .join(", ")}]`
  );
  output(`(with ${targetEfficiency * 100}% target efficiency)\n`);

  return { pools, rewardsPerVote };
}

/**
 * Hardhat task to calculate and display the MaxPricePerVote for all Curve Pool Boosters
 */
async function calculateMaxPricePerVoteTask(taskArguments) {
  const targetEfficiency = parseFloat(taskArguments.efficiency || "1");
  const skipRewardPerVote = taskArguments.skip || false;
  const output = taskArguments.output ? console.log : log;

  // Use Hardhat's global ethers provider
  const { rewardsPerVote } = await calculateRewardsPerVote(ethers.provider, {
    targetEfficiency,
    skipRewardPerVote,
    log: output,
  });

  return rewardsPerVote;
}

/**
 * Calls manageBribes on the pool booster bribes module which extends the active Vote Marke campaigns
 * and overrides the max reward per vote for each pool booster according to the target efficiency
 */
async function manageBribes({
  provider,
  signer,
  targetEfficiency,
  skipRewardPerVote,
}) {
  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(
      `Action should only be run on mainnet, not on network with chainId ${chainId}`
    );
  }

  const bribesModuleContract = new ethers.Contract(
    BRIBES_MODULE,
    // old pool booster bribes module
    //"0x12856b1944a6a8c86c61D0F8B6e44C37726e86D7",
    bribesModuleAbi,
    signer
  );

  const { pools, rewardsPerVote } = await calculateRewardsPerVote(provider, {
    targetEfficiency,
    skipRewardPerVote,
    log,
  });

  if (rewardsPerVote.length === 0) {
    log("No pool boosters registered in BribesModule, nothing to do");
    return;
  }

  // Call manageBribes on the SafeModule
  log(`\n--- Calling manageBribes on BribesModule ---`);

  let tx;
  if (skipRewardPerVote) {
    // Use the no-arg version (defaults: all rewards, +1 period, no reward rate update)
    log("Using default parameters (no-arg manageBribes)");
    tx = await bribesModuleContract["manageBribes()"]();
  } else {
    // Build default arrays for totalRewardAmounts and extraDuration
    const totalRewardAmounts = pools.map(() => ethers.constants.MaxUint256);
    const extraDuration = pools.map(() => 1);

    log(
      `Rewards per vote: [${rewardsPerVote
        .map((r) => formatUnits(r, 18))
        .join(", ")}]`
    );
    tx = await bribesModuleContract[
      "manageBribes(uint256[],uint8[],uint256[])"
    ](totalRewardAmounts, extraDuration, rewardsPerVote);
  }
  const receipt = await logTxDetails(tx, "manageBribes");

  // Final verification
  if (receipt.status === 1) {
    log("SUCCESS: Transaction executed successfully!");
  } else {
    log("FAILURE: Transaction reverted!");
    throw new Error(`Transaction reverted - status: ${receipt.status}`);
  }
}

module.exports = {
  // Hardhat task
  calculateMaxPricePerVoteTask,
  // Shared function for defender action
  calculateRewardsPerVote,
  // manage bribes action on the pool booster bribes module
  manageBribes,
};
