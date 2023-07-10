const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const poolAbi = require("../test/abi/ousdMetapool.json");
const addresses = require("../utils/addresses");
const { resolveAsset } = require("../utils/assets");

/**
 * Dumps the current state of a Curve Metapool pool used for AMO
 */
async function curvePool(taskArguments, hre) {
  // Get the block to get all the data from
  const blockTag = !taskArguments.block
    ? await hre.ethers.provider.getBlockNumber()
    : taskArguments.block;
  console.log(`block: ${blockTag}`);
  const fromBlockTag = taskArguments.fromBlock || 0;
  const diffBlocks = fromBlockTag > 0;

  // Get symbols of tokens in the pool
  const oTokenSymbol = taskArguments.pool;
  const assetSymbol = oTokenSymbol === "OETH" ? "ETH " : "3CRV";

  // Get the contract addresses
  const poolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CurveOETHMetaPool
      : addresses.mainnet.CurveOUSDMetaPool;
  const strategyAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.ConvexOUSDAMOStrategy;
  const convexRewardsPoolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CVXETHRewardsPool
      : addresses.mainnet.CVXRewardsPool;
  const poolLPSymbol = oTokenSymbol === "OETH" ? "OETHCRV-f" : "OUSD3CRV-f";
  const vaultAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHVaultProxy
      : addresses.mainnet.VaultProxy;
  const oTokenAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHProxy
      : addresses.mainnet.OUSDProxy;
  // TODO condition to set to WETH or 3CRV
  const asset = await resolveAsset("WETH");

  // Load all the contracts
  const pool = await hre.ethers.getContractAt(poolAbi, poolAddr);
  const cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    convexRewardsPoolAddr
  );
  const amoStrategy = await ethers.getContractAt("IStrategy", strategyAddr);
  const oToken = await ethers.getContractAt("IERC20", oTokenAddr);
  const vault = await ethers.getContractAt("IVault", vaultAddr);

  // Get Metapool data
  const poolBalancesBefore =
    diffBlocks &&
    (await pool.get_balances({
      blockTag: fromBlockTag,
    }));
  const poolBalances = await pool.get_balances({ blockTag });
  const virtualPriceBefore =
    diffBlocks &&
    (await pool.get_virtual_price({
      blockTag: fromBlockTag,
    }));
  const virtualPrice = await pool.get_virtual_price({ blockTag });
  console.log(
    `LP virtual price: ${formatUnits(
      virtualPrice
    )} ${oTokenSymbol} ${displayDiff(
      diffBlocks,
      virtualPrice,
      virtualPriceBefore,
      6
    )}`
  );

  // swap 1 OETH for ETH (OETH/ETH)
  const price1Before =
    diffBlocks &&
    (await pool["get_dy(int128,int128,uint256)"](1, 0, parseUnits("1"), {
      blockTag: fromBlockTag,
    }));
  const price1 = await pool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1"),
    { blockTag }
  );
  console.log(
    `${oTokenSymbol}/${assetSymbol} price : ${formatUnits(
      price1
    )} ${displayDiff(diffBlocks, price1, price1Before, 6)}`
  );

  // swap 1 ETH for OETH (ETH/OETH)
  const price2Before =
    diffBlocks &&
    (await pool["get_dy(int128,int128,uint256)"](0, 1, parseUnits("1"), {
      blockTag: fromBlockTag,
    }));
  const price2 = await pool["get_dy(int128,int128,uint256)"](
    0,
    1,
    parseUnits("1"),
    { blockTag }
  );
  console.log(
    `${assetSymbol}/${oTokenSymbol} price : ${formatUnits(
      price2
    )} ${displayDiff(diffBlocks, price2, price2Before, 6)}`
  );

  // Get the Strategy's Metapool LPs in the Convex pool
  const vaultLPsBefore =
    diffBlocks &&
    (await cvxRewardPool.balanceOf(strategyAddr, { blockTag: fromBlockTag }));
  const vaultLPs = await cvxRewardPool.balanceOf(strategyAddr, { blockTag });
  const totalLPsBefore =
    diffBlocks && (await pool.totalSupply({ blockTag: fromBlockTag }));
  const totalLPs = await pool.totalSupply({ blockTag });
  console.log(
    `vault Metapool LPs       : ${displayPortion(
      vaultLPs,
      totalLPs,
      poolLPSymbol,
      "total supply"
    )} ${displayDiff(diffBlocks, vaultLPs, vaultLPsBefore)}`
  );

  // Total Metapool assets
  const totalBalances = poolBalances[0].add(poolBalances[1]);
  console.log(
    `\ntotal assets in pool     : ${displayPortion(
      poolBalances[0],
      totalBalances,
      assetSymbol,
      "pool",
      4
    )} ${displayDiff(diffBlocks, poolBalances[0], poolBalancesBefore[0])}`
  );
  console.log(
    `total OTokens in pool    : ${displayPortion(
      poolBalances[1],
      totalBalances,
      oTokenSymbol,
      "pool",
      4
    )} ${displayDiff(diffBlocks, poolBalances[1], poolBalancesBefore[1])}`
  );

  // total vault value
  const vaultTotalValueBefore =
    diffBlocks && (await vault.totalValue({ blockTag: fromBlockTag }));
  const vaultTotalValue = await vault.totalValue({ blockTag });
  // Total supply of OTokens
  const oTokenSupplyBefore =
    diffBlocks && (await oToken.totalSupply({ blockTag: fromBlockTag }));
  const oTokenSupply = await oToken.totalSupply({ blockTag });
  // Assets in the pool
  const strategyAssetsInPoolBefore =
    diffBlocks && poolBalancesBefore[0].mul(vaultLPsBefore).div(totalLPsBefore);
  const strategyAssetsInPool = poolBalances[0].mul(vaultLPs).div(totalLPs);
  // OTokens in the pool
  const strategyOTokensInPoolBefore =
    diffBlocks && poolBalancesBefore[1].mul(vaultLPsBefore).div(totalLPsBefore);
  const strategyOTokensInPool = poolBalances[1].mul(vaultLPs).div(totalLPs);
  // Adjusted total vault value
  const vaultAdjustedTotalValueBefore =
    diffBlocks && vaultTotalValueBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalValue = vaultTotalValue.sub(strategyOTokensInPool);
  // Adjusted total supply of OTokens
  const vaultAdjustedTotalSupplyBefore =
    diffBlocks && oTokenSupplyBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalSupply = oTokenSupply.sub(strategyOTokensInPool);

  // Strategy's share of the assets in the pool
  console.log(
    `\nassets owned by strategy : ${displayPortion(
      strategyAssetsInPool,
      vaultAdjustedTotalValue,
      assetSymbol,
      "adjusted vault value"
    )} ${displayDiff(
      diffBlocks,
      strategyAssetsInPool,
      strategyAssetsInPoolBefore
    )}`
  );

  // Strategy's share of the oTokens in the pool
  console.log(
    `OTokens owned by strategy: ${displayPortion(
      strategyOTokensInPool,
      vaultAdjustedTotalValue,
      oTokenSymbol,
      "OToken supply"
    )} ${displayDiff(
      diffBlocks,
      strategyOTokensInPool,
      strategyOTokensInPoolBefore
    )}`
  );
  const stratTotalInPool = strategyAssetsInPool.add(strategyOTokensInPool);
  console.log(`both owned by strategy   : ${formatUnits(stratTotalInPool)}`);

  // Strategies assets value
  const strategyAssetsValueBefore =
    diffBlocks &&
    (await amoStrategy.checkBalance(asset.address, {
      blockTag: fromBlockTag,
    }));
  const strategyAssetsValue = await amoStrategy.checkBalance(asset.address, {
    blockTag,
  });
  console.log(
    `strategy assets value    : ${displayPortion(
      strategyAssetsValue,
      vaultTotalValue,
      assetSymbol,
      "vault value"
    )} ${displayDiff(
      diffBlocks,
      strategyAssetsValue,
      strategyAssetsValueBefore
    )}`
  );

  // Adjusted strategy value = strategy assets value - strategy OTokens
  // Assume all OETH owned by the strategy will be burned after withdrawing
  // so are just left with the assets backing circulating OETH
  const strategyAdjustedValueBefore =
    diffBlocks && strategyAssetsValueBefore.sub(strategyOTokensInPoolBefore);
  const strategyAdjustedValue = strategyAssetsValue.sub(strategyOTokensInPool);
  console.log(
    `strategy adjusted value  : ${displayPortion(
      strategyAdjustedValue,
      vaultAdjustedTotalValue,
      assetSymbol,
      "adjusted vault value"
    )} ${displayDiff(
      diffBlocks,
      strategyAdjustedValue,
      strategyAdjustedValueBefore
    )}`
  );
  console.log(
    `owned - adjusted value   : ${displayRatio(
      strategyAssetsInPool,
      strategyAdjustedValue,
      strategyAssetsInPoolBefore,
      strategyAdjustedValueBefore
    )}`
  );

  const assetsInVaultBefore =
    diffBlocks &&
    (await asset.balanceOf(vaultAddr, {
      blockTag: fromBlockTag,
    }));
  const assetsInVault = await asset.balanceOf(vaultAddr, { blockTag });
  console.log(
    `\nAssets in vault          : ${formatUnits(
      assetsInVault
    )} ${assetSymbol} ${displayDiff(
      diffBlocks,
      assetsInVault,
      assetsInVaultBefore
    )}`
  );

  // Vault's total value v total supply
  console.log(
    `\nOToken total supply      : ${formatUnits(
      oTokenSupply
    )} ${oTokenSymbol} ${displayDiff(
      diffBlocks,
      oTokenSupply,
      oTokenSupplyBefore
    )}`
  );
  console.log(
    `vault assets value       : ${formatUnits(
      vaultTotalValue
    )} ${assetSymbol} ${displayDiff(
      diffBlocks,
      vaultTotalValue,
      vaultTotalValueBefore
    )}`
  );
  console.log(
    `total value - supply     : ${displayRatio(
      vaultTotalValue,
      oTokenSupply,
      vaultTotalValueBefore,
      oTokenSupplyBefore
    )}`
  );
  // Adjusted total value v total supply
  console.log(
    `OToken adjust supply     : ${formatUnits(
      vaultAdjustedTotalSupply
    )} ${oTokenSymbol} ${displayDiff(
      diffBlocks,
      vaultAdjustedTotalSupply,
      vaultAdjustedTotalSupplyBefore
    )}`
  );
  console.log(
    `vault adjusted value     : ${formatUnits(
      vaultAdjustedTotalValue
    )} ${assetSymbol} ${displayDiff(
      diffBlocks,
      vaultAdjustedTotalValue,
      vaultAdjustedTotalValueBefore
    )}`
  );
  console.log(
    `adjusted value - supply  : ${displayRatio(
      vaultAdjustedTotalValue,
      vaultAdjustedTotalSupply,
      vaultAdjustedTotalValueBefore,
      vaultAdjustedTotalSupplyBefore
    )}`
  );

  const netMintedForStrategy = await vault.netOusdMintedForStrategy({
    blockTag,
  });
  const netMintedForStrategyThreshold =
    await vault.netOusdMintForStrategyThreshold({ blockTag });
  const netMintedForStrategyDiff =
    netMintedForStrategyThreshold.sub(netMintedForStrategy);
  console.log(
    `\nNet minted for strategy  : ${formatUnits(netMintedForStrategy)}`
  );
  console.log(
    `Net minted threshold     : ${formatUnits(netMintedForStrategyThreshold)}`
  );
  console.log(
    `Net minted for strat diff: ${formatUnits(netMintedForStrategyDiff)}`
  );
}

function displayDiff(diffBlocks, newValue, oldValue, precision = 2) {
  if (!diffBlocks) return "";
  // Calculate the difference between the new and old value
  const diff = newValue.sub(oldValue);
  // Calculate the percentage difference if the old value is not zerp
  const diffPercentage =
    oldValue.gt(0) &&
    diff.mul(BigNumber.from(10).pow(2 + precision)).div(oldValue);
  // Only display the percentage difference if the old value is not zero
  const displayPercentage = diffPercentage
    ? ` ${formatUnits(diffPercentage, precision)}%`
    : "";
  // Return the formatted display string
  return `\t${diff.gt(0) ? "+" : ""}${formatUnits(
    newValue.sub(oldValue)
  )}${displayPercentage}`;
}

function displayPortion(amount, total, units, comparison, precision = 2) {
  const basisPoints = amount
    .mul(BigNumber.from(10).pow(2 + precision))
    .div(total);
  return `${formatUnits(amount)} ${units} ${formatUnits(
    basisPoints,
    precision
  )}%${comparison ? " of " + comparison : ""}`;
}

function displayRatio(a, b, aBefore, bBefore, precision = 6) {
  const diff = a.sub(b);
  const diffPercentage = a.gt(0)
    ? diff.mul(BigNumber.from(10).pow(2 + precision)).div(b)
    : BigNumber.from(0);

  let diffBeforeDisplay = "";
  if (aBefore && bBefore) {
    const diffBefore = aBefore && bBefore && aBefore.sub(bBefore);
    diffBeforeDisplay = displayDiff(aBefore, diff, diffBefore, precision);
  }
  return `${formatUnits(diff)} ${formatUnits(
    diffPercentage,
    precision
  )}% ${diffBeforeDisplay}`;
}

module.exports = {
  curvePool,
};
