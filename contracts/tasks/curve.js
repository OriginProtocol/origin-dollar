const { logCurvePool, log } = require("../utils/curve");
const { formatUnits } = require("ethers/lib/utils");

const addresses = require("../utils/addresses");
const poolAbi = require("../test/abi/ousdMetapool.json");
const { resolveAsset } = require("../utils/assets");
const { BigNumber } = require("ethers");

/**
 * Dumps the current state of a Curve Metapool pool used for AMO
 */
async function curvePool(taskArguments, hre) {
  // explicitly enable logging
  log.enabled = true;

  const oTokenSymbol = taskArguments.pool;
  const assetSymbol = oTokenSymbol === "OETH" ? "ETH " : "3CRV";
  const poolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CurveOETHMetaPool
      : addresses.mainnet.CurveOUSDMetaPool;

  // Get the block to get all the data from
  const blockTag =
    taskArguments.block === 0
      ? await hre.ethers.provider.getBlockNumber()
      : taskArguments.block;
  console.log(`block: ${blockTag}`);

  // TODO set based on oTokenSymbol
  const startBlock = 17249889;

  // Get the contract addresses
  const vaultAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHVaultProxy
      : addresses.mainnet.OUSDVaultProxy;
  const strategyAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.ConvexOUSDAMOStrategy;
  const convexRewardsPoolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CVXETHRewardsPool
      : addresses.mainnet.CVXRewardsPool;
  const poolLPSymbol = oTokenSymbol === "OETH" ? "OETHCRV-f" : "OUSD3CRV-f";

  // Load all the contracts
  const pool = await hre.ethers.getContractAt(poolAbi, poolAddr);
  const { balances: poolBalances } = await logCurvePool(
    pool,
    assetSymbol,
    oTokenSymbol,
    blockTag
  );
  const cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    convexRewardsPoolAddr
  );
  const amoStrategy = await ethers.getContractAt("IStrategy", strategyAddr);

  // Assets sent to strategy
  const asset = await resolveAsset("WETH");
  const oToken = await resolveAsset("OETH");

  // Get the Strategy's Metapool LPs in the Convex pool
  const vaultLPs = await cvxRewardPool.balanceOf(strategyAddr, { blockTag });
  const totalLPs = await pool.totalSupply({ blockTag });
  const vaultBasisPoints = vaultLPs.mul(10000).div(totalLPs);
  console.log(
    `vault Metapool LPs       : ${formatUnits(vaultLPs)} of ${formatUnits(
      totalLPs
    )} ${poolLPSymbol} ${formatUnits(vaultBasisPoints, 2)}%`
  );

  // Total Metapool assets
  const totalBalances = poolBalances[0].add(poolBalances[1]);
  const ethBasisPoints = poolBalances[0].mul(10000).div(totalBalances);
  const oethBasisPoints = poolBalances[1].mul(10000).div(totalBalances);
  console.log(
    `\ntotal assets in pool     : ${formatUnits(
      poolBalances[0]
    )} ${assetSymbol} ${formatUnits(ethBasisPoints, 2)}%`
  );
  console.log(
    `total OTokens in pool    : ${formatUnits(
      poolBalances[1]
    )} ${oTokenSymbol} ${formatUnits(oethBasisPoints, 2)}%`
  );

  // Strategy's share of the assets in the pool
  const strategyAssetsInPool = poolBalances[0].mul(vaultLPs).div(totalLPs);
  const strategyOTokensInPool = poolBalances[1].mul(vaultLPs).div(totalLPs);
  console.log(
    `\nassets owned by strategy : ${formatUnits(
      strategyAssetsInPool
    )} ${assetSymbol} (${formatUnits(vaultBasisPoints, 2)}% of pool)`
  );
  console.log(
    `OTokens owned by strategy: ${formatUnits(
      strategyOTokensInPool
    )} ${oTokenSymbol} (${formatUnits(vaultBasisPoints, 2)}% of pool)`
  );
  const stratTotalInPool = strategyAssetsInPool.add(strategyOTokensInPool);
  console.log(`both owned by strategy   : ${formatUnits(stratTotalInPool)}`);

  // Strategies assets value
  const strategyAssetsValue = await amoStrategy.checkBalance(asset.address, {
    blockTag,
  });
  console.log(
    `strategy assets value    : ${formatUnits(
      strategyAssetsValue
    )} ${assetSymbol}`
  );

  // Assets sent to the strategy
  const strategyAssetsSent = await assetInStrategy(
    vaultAddr,
    strategyAddr,
    asset,
    17249889,
    blockTag
  );
  console.log(
    `\nassets sent to strategy  : ${formatUnits(
      strategyAssetsSent
    )} ${assetSymbol}`
  );
  const strategyAssetDiff = strategyAssetsInPool.sub(strategyAssetsSent);
  const strategyAssetsBasisPoints = strategyAssetsInPool
    .mul(10000)
    .div(strategyAssetsSent);
  console.log(
    `assets owned v sent      : ${formatUnits(
      strategyAssetDiff
    )} ${assetSymbol} ${formatUnits(strategyAssetsBasisPoints, 2)}%`
  );

  // OTokens sent to the strategy
  const strategyOTokensSent = await assetInStrategy(
    addresses.zero,
    strategyAddr,
    oToken,
    17249889,
    blockTag
  );
  console.log(
    `\nOTokens sent to strategy : ${formatUnits(
      strategyOTokensSent
    )} ${oTokenSymbol}`
  );
  const strategyOTokenDiff = strategyOTokensInPool.sub(strategyOTokensSent);
  const strategyOTokensBasisPoints = strategyOTokensInPool
    .mul(10000)
    .div(strategyOTokensSent);
  console.log(
    `OTokens owned v sent     : ${formatUnits(
      strategyOTokenDiff
    )} ${oTokenSymbol} ${formatUnits(strategyOTokensBasisPoints, 2)}%`
  );

  // AMO minted OTokens
  const oTokensMinted = await amoMint(
    pool.address,
    strategyAddr,
    oToken,
    startBlock,
    blockTag
  );
  console.log(`\nAMO minted OTokens       : ${formatUnits(oTokensMinted)}`);

  // AMO burned OTokens
  const oTokensBurned = await amoBurn(
    pool.address,
    strategyAddr,
    oToken,
    startBlock,
    blockTag
  );
  console.log(`AMO burned OTokens       : ${formatUnits(oTokensBurned)}`);
  const oTokensDiff = oTokensMinted.sub(oTokensBurned);
  console.log(`AMO minted v burned      : ${formatUnits(oTokensDiff)}`);

  const oTokensMintedFromStrategy = oTokensMinted.mul(vaultLPs).div(totalLPs);
  const oTokensBurnedFromStrategy = oTokensBurned.mul(vaultLPs).div(totalLPs);
  console.log(
    `\nAMO minted OTokens from strat: ${formatUnits(oTokensMintedFromStrategy)}`
  );
  console.log(
    `AMO burned OTokens from strat: ${formatUnits(oTokensBurnedFromStrategy)}`
  );
  const oTokensFromStrategyDiff = oTokensMintedFromStrategy.sub(
    oTokensBurnedFromStrategy
  );
  console.log(
    `AMO mint v burn from strategy: ${formatUnits(oTokensFromStrategyDiff)}`
  );
}

async function assetInStrategy(
  vaultAddr,
  strategyAddr,
  asset,
  startBlock,
  endBlock
) {
  // Get all the asset transfers to the strategy
  const deposits = await sumTransfers(
    asset,
    vaultAddr,
    strategyAddr,
    startBlock,
    endBlock
  );
  // Get all the asset transfers from the strategy
  const withdraws = await sumTransfers(
    asset,
    strategyAddr,
    vaultAddr,
    startBlock,
    endBlock
  );
  const total = deposits.sub(withdraws);

  return total;
}

async function amoMint(poolAddr, strategyAddr, oToken, startBlock, endBlock) {
  // Get all the OTokens transfers from the pool
  const oTokensOut = await sumTransfers(
    oToken,
    poolAddr,
    null,
    startBlock,
    endBlock
  );
  // Get all the OTokens transfers from the pool to the strategy
  const oTokensOutToStrategy = await sumTransfers(
    oToken,
    poolAddr,
    strategyAddr,
    startBlock,
    endBlock
  );

  return oTokensOut.sub(oTokensOutToStrategy);
}

async function amoBurn(poolAddr, strategyAddr, oTokens, startBlock, endBlock) {
  // Get all the OTokens transfers to the pool
  const oTokensIn = await sumTransfers(
    oTokens,
    null,
    poolAddr,
    startBlock,
    endBlock
  );
  // Get all the OTokens transfers to the pool from the strategy
  const oTokensInFromStrategy = await sumTransfers(
    oTokens,
    strategyAddr,
    poolAddr,
    startBlock,
    endBlock
  );

  return oTokensIn.sub(oTokensInFromStrategy);
}

// Sums all the transfers from one account to another between two blocks
async function sumTransfers(token, fromAddr, toAddr, startBlock, endBlock) {
  const eventFilter = token.filters.Transfer(fromAddr, toAddr);
  const events = await token.queryFilter(eventFilter, startBlock, endBlock);

  let total = BigNumber.from(0);
  for (const event of events) {
    total = total.add(event.args.value);
  }
  return total;
}

module.exports = {
  curvePool,
};
