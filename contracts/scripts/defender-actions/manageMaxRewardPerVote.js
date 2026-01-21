const { ethers } = require("ethers");
const { Defender } = require("@openzeppelin/defender-sdk");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { logTxDetails } = require("../../utils/txLogger");

const log = require("../../utils/logger")("action:manageMaxRewardPerVote");

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

// Minimal ABIs for the contracts we interact with
const bribesModuleAbi = [
  "function getPools() external view returns (address[])",
  "function manageBribes(uint256[] memory rewardsPerVote) external",
];

const poolBoosterAbi = [
  "function rewardToken() external view returns (address)",
];

const gaugeControllerAbi = [
  "function get_total_weight() external view returns (uint256)",
];

const veCRVAbi = ["function totalSupply() external view returns (uint256)"];

const crvAbi = ["function rate() external view returns (uint256)"];

// Curve pool ABI for price queries
// For 2-coin pools with int128 indices (OETH/WETH)
const curvePool2Abi = [
  "function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)",
];

// For NG pools and tricrypto pools with uint256 indices (OUSD/USDC, crvUSD/ETH/CRV)
const curvePoolNGAbi = [
  "function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256)",
];

// Constants
const SECONDS_PER_WEEK = 60 * 60 * 24 * 7;

/**
 * Get OETH price in ETH from the OETH/WETH Curve pool
 * Assumes 1 WETH = 1 ETH
 * Pool composition: 0 = ETH, 1 = OETH
 * @param {ethers.providers.Provider} provider
 * @returns {Promise<ethers.BigNumber>} OETH price in ETH (18 decimals)
 */
async function getOETHPriceInETH(provider) {
  const pool = new ethers.Contract(OETH_WETH_POOL, curvePool2Abi, provider);
  // Get how much WETH (index 0) we get for 1 OETH (index 1)
  const oethPriceInEth = await pool["get_dy(int128,int128,uint256)"](
    1, // from OETH
    0, // to ETH
    parseUnits("1", 18)
  );
  log(`OETH price in ETH: ${formatUnits(oethPriceInEth, 18)}`);
  return oethPriceInEth;
}

/**
 * Get OUSD price in USD from the OUSD/USDC Curve NG pool
 * Assumes 1 USDC = 1 USD
 * Pool composition: 0 = OUSD, 1 = USDC
 * @param {ethers.providers.Provider} provider
 * @returns {Promise<ethers.BigNumber>} OUSD price in USD (18 decimals)
 */
async function getOUSDPriceInUSD(provider) {
  const pool = new ethers.Contract(OUSD_USDC_POOL, curvePoolNGAbi, provider);
  // Get how much USDC (index 1) we get for 1 OUSD (index 0)
  // USDC is 6 decimals, so we need to scale up to 18 decimals
  const ousdPriceInUsdc = await pool["get_dy(uint256,uint256,uint256)"](
    0, // from OUSD
    1, // to USDC
    parseUnits("1", 18)
  );
  // Scale from 6 decimals to 18 decimals
  const ousdPriceInUsd = ousdPriceInUsdc.mul(parseUnits("1", 12));
  log(`OUSD price in USD: ${formatUnits(ousdPriceInUsd, 18)}`);
  return ousdPriceInUsd;
}

/**
 * Get CRV price in USD from the crvUSD/ETH/CRV tricrypto pool
 * Assumes 1 crvUSD = 1 USD
 * Pool composition: 0 = crvUSD, 1 = ETH, 2 = CRV
 * @param {ethers.providers.Provider} provider
 * @returns {Promise<ethers.BigNumber>} CRV price in USD (18 decimals)
 */
async function getCRVPriceInUSD(provider) {
  const pool = new ethers.Contract(
    CRV_USD_ETH_CRV_POOL,
    curvePoolNGAbi,
    provider
  );
  // Get how much crvUSD (index 0) we get for 1 CRV (index 2)
  const crvPriceInUsd = await pool["get_dy(uint256,uint256,uint256)"](
    2, // from CRV
    0, // to crvUSD
    parseUnits("1", 18)
  );
  log(`CRV price in USD: ${formatUnits(crvPriceInUsd, 18)}`);
  return crvPriceInUsd;
}

/**
 * Get ETH price in USD from the crvUSD/ETH/CRV tricrypto pool
 * Assumes 1 crvUSD = 1 USD
 * Pool composition: 0 = crvUSD, 1 = ETH, 2 = CRV
 * @param {ethers.providers.Provider} provider
 * @returns {Promise<ethers.BigNumber>} ETH price in USD (18 decimals)
 */
async function getETHPriceInUSD(provider) {
  const pool = new ethers.Contract(
    CRV_USD_ETH_CRV_POOL,
    curvePoolNGAbi,
    provider
  );
  // Get how much crvUSD (index 0) we get for 1 ETH (index 1)
  const ethPriceInUsd = await pool["get_dy(uint256,uint256,uint256)"](
    1, // from ETH
    0, // to crvUSD
    parseUnits("1", 18)
  );
  log(`ETH price in USD: ${formatUnits(ethPriceInUsd, 18)}`);
  return ethPriceInUsd;
}

/**
 * Fetch CRV emission data needed for price calculation
 * @param {ethers.providers.Provider} provider
 * @returns {Promise<{totalWeight: BigNumber, emissionPerWeek: BigNumber, crvPriceInUsd: BigNumber}>}
 */
async function fetchEmissionData(provider) {
  const gaugeController = new ethers.Contract(
    GAUGE_CONTROLLER,
    gaugeControllerAbi,
    provider
  );
  const veCRV = new ethers.Contract(VE_CRV, veCRVAbi, provider);
  const crv = new ethers.Contract(CRV, crvAbi, provider);

  const [totalWeight, veCRVTotalSupply, crvRate, crvPriceInUsd] =
    await Promise.all([
      gaugeController.get_total_weight(),
      veCRV.totalSupply(),
      crv.rate(),
      getCRVPriceInUSD(provider),
    ]);

  log(`Total Weight (36 decimals): ${formatUnits(totalWeight, 36)}`);
  log(`veCRV Total Supply: ${formatUnits(veCRVTotalSupply, 18)}`);
  log(`CRV Rate (per second): ${formatUnits(crvRate, 18)}`);

  const emissionPerWeek = crvRate.mul(SECONDS_PER_WEEK);
  log(`CRV Emission per week: ${formatUnits(emissionPerWeek, 18)}`);

  // VoterPercent = TotalWeight / veCRVTotalSupply (result in 18 decimals)
  const voterPercentScaled = totalWeight.div(veCRVTotalSupply);
  log(
    `Voter Percent (scaled 1e18 = 100%): ${formatUnits(voterPercentScaled, 18)}`
  );

  return { totalWeight, emissionPerWeek, crvPriceInUsd };
}

/**
 * Calculate EmissionValuePerVote in USD
 * @param {BigNumber} emissionPerWeek
 * @param {BigNumber} crvPriceInUsd
 * @param {BigNumber} totalWeight
 * @returns {BigNumber} EmissionValuePerVote in USD (18 decimals)
 */
function calculateEmissionValuePerVote(
  emissionPerWeek,
  crvPriceInUsd,
  totalWeight
) {
  // EmissionValuePerVote = (EmissionPerWeek * CRVPrice) / TotalWeight
  // Scale up by 1e18 to maintain 18 decimals (since totalWeight is 36 decimals)
  const emissionValuePerVote = emissionPerWeek
    .mul(crvPriceInUsd)
    .mul(parseUnits("1", 18))
    .div(totalWeight);
  log(
    `Emission Value per Vote (USD): ${formatUnits(emissionValuePerVote, 18)}`
  );
  return emissionValuePerVote;
}

/**
 * Calculate MaxPricePerVote for a given reward token price
 * @param {BigNumber} emissionValuePerVote - in USD (18 decimals)
 * @param {BigNumber} rewardTokenPriceInUsd - in USD (18 decimals)
 * @param {number} targetEfficiency - e.g., 1 for 100%
 * @returns {BigNumber} MaxPricePerVote in reward token (18 decimals)
 */
function calculateMaxPricePerVote(
  emissionValuePerVote,
  rewardTokenPriceInUsd,
  targetEfficiency
) {
  const targetEfficiencyScaled = parseUnits(targetEfficiency.toString(), 18);

  // MaxPricePerVote = EmissionValuePerVote / (RewardTokenPriceInUSD * TargetEfficiency)
  const maxPricePerVote = emissionValuePerVote
    .mul(parseUnits("1", 18))
    .div(
      rewardTokenPriceInUsd.mul(targetEfficiencyScaled).div(parseUnits("1", 18))
    );

  return maxPricePerVote;
}

/**
 * Get the price of a reward token in USD
 * @param {string} rewardToken - Address of the reward token
 * @param {ethers.providers.Provider} provider
 * @param {BigNumber} ethPriceInUsd - ETH price in USD (for OETH calculation)
 * @returns {Promise<BigNumber>} Price in USD (18 decimals)
 */
async function getRewardTokenPriceInUSD(rewardToken, provider, ethPriceInUsd) {
  const rewardTokenLower = rewardToken.toLowerCase();

  if (rewardTokenLower === OETH.toLowerCase()) {
    const oethPriceInEth = await getOETHPriceInETH(provider);
    const oethPriceInUsd = oethPriceInEth
      .mul(ethPriceInUsd)
      .div(parseUnits("1", 18));
    log(`OETH price in USD: ${formatUnits(oethPriceInUsd, 18)}`);
    return oethPriceInUsd;
  } else if (rewardTokenLower === OUSD.toLowerCase()) {
    return await getOUSDPriceInUSD(provider);
  } else {
    throw new Error(`Unknown reward token: ${rewardToken}`);
  }
}

// Entrypoint for the Defender Action
const handler = async (event) => {
  console.log(
    `DEBUG env var in handler before being set: "${process.env.DEBUG}"`
  );

  // Initialize defender relayer provider and signer
  const client = new Defender(event);
  const provider = client.relaySigner.getProvider({ ethersVersion: "v5" });
  const signer = await client.relaySigner.getSigner(provider, {
    speed: "fastest",
    ethersVersion: "v5",
  });

  const { chainId } = await provider.getNetwork();
  if (chainId !== 1) {
    throw new Error(
      `Action should only be run on mainnet, not on network with chainId ${chainId}`
    );
  }

  // Get the SafeModule contract
  const bribesModule = new ethers.Contract(
    BRIBES_MODULE,
    bribesModuleAbi,
    signer
  );

  // Fetch all pools from the SafeModule
  const pools = await bribesModule.getPools();
  log(`Found ${pools.length} pools in BribesModule`);

  if (pools.length === 0) {
    log("No pools registered in BribesModule, nothing to do");
    return;
  }

  // Check if we should skip setting RewardPerVote (pass array of zeros)
  const skipRewardPerVote = event.request?.body?.skipRewardPerVote ?? false;

  let rewardsPerVote;

  if (skipRewardPerVote) {
    // Pass an array of zeros - SafeModule will skip setting RewardPerVote
    log("skipRewardPerVote=true, passing array of zeros");
    rewardsPerVote = pools.map(() => ethers.BigNumber.from(0));
  } else {
    // Calculate maxPricePerVote for each pool
    const targetEfficiency = event.request?.body?.targetEfficiency ?? 1;
    log(`Target efficiency: ${targetEfficiency * 100}%`);

    if (targetEfficiency <= 0 || targetEfficiency > 10) {
      throw new Error(
        `Invalid target efficiency: ${targetEfficiency}. Must be between 0 and 10.`
      );
    }

    // Fetch emission data (shared across all pools)
    log("\n--- Fetching emission data ---");
    const { totalWeight, emissionPerWeek, crvPriceInUsd } =
      await fetchEmissionData(provider);
    const emissionValuePerVote = calculateEmissionValuePerVote(
      emissionPerWeek,
      crvPriceInUsd,
      totalWeight
    );

    // Fetch ETH price (needed for OETH price calculation)
    const ethPriceInUsd = await getETHPriceInUSD(provider);

    // Calculate maxPricePerVote for each pool based on its reward token
    rewardsPerVote = [];

    for (let i = 0; i < pools.length; i++) {
      const poolAddress = pools[i];
      log(`\n--- Processing pool ${i + 1}/${pools.length}: ${poolAddress} ---`);

      // Get reward token for this pool
      const poolBooster = new ethers.Contract(
        poolAddress,
        poolBoosterAbi,
        provider
      );
      const rewardToken = await poolBooster.rewardToken();
      log(`Reward token: ${rewardToken}`);

      // Get reward token price in USD
      const rewardTokenPriceInUsd = await getRewardTokenPriceInUSD(
        rewardToken,
        provider,
        ethPriceInUsd
      );

      // Calculate maxPricePerVote for this pool
      const maxPricePerVote = calculateMaxPricePerVote(
        emissionValuePerVote,
        rewardTokenPriceInUsd,
        targetEfficiency
      );
      log(`Max Price per Vote: ${formatUnits(maxPricePerVote, 18)}`);

      rewardsPerVote.push(maxPricePerVote);
    }
  }

  // Call manageBribes on the SafeModule
  log(`\n--- Calling manageBribes on BribesModule ---`);
  log(
    `Rewards per vote: [${rewardsPerVote
      .map((r) => formatUnits(r, 18))
      .join(", ")}]`
  );

  const tx = await bribesModule.connect(signer).manageBribes(rewardsPerVote);
  await logTxDetails(tx, "manageBribes");
};

module.exports = { handler };
