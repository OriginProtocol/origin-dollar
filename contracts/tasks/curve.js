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
  const asset =
    oTokenSymbol === "OETH"
      ? await resolveAsset("WETH")
      : await resolveAsset("3CRV");

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
  const totalLPsBefore =
    diffBlocks && (await pool.totalSupply({ blockTag: fromBlockTag }));
  const totalLPs = await pool.totalSupply({ blockTag });
  const virtualPriceBefore =
    diffBlocks &&
    (await pool.get_virtual_price({
      blockTag: fromBlockTag,
    }));
  const virtualPrice = await pool.get_virtual_price({ blockTag });
  const invariant = virtualPrice.mul(totalLPs).div(parseUnits("1"));
  const invariantBefore =
    diffBlocks && virtualPriceBefore.mul(totalLPsBefore).div(parseUnits("1"));
  displayProperty(
    "Pool LP total supply",
    poolLPSymbol,
    totalLPs,
    totalLPsBefore,
    6
  );
  displayProperty("Invariant (D) ", "", invariant, invariantBefore, 6);
  displayProperty(
    "LP virtual price",
    assetSymbol,
    virtualPrice,
    virtualPriceBefore,
    6
  );

  // Pool balances
  const poolBalancesBefore =
    diffBlocks &&
    (await pool.get_balances({
      blockTag: fromBlockTag,
    }));
  const poolBalances = await pool.get_balances({ blockTag });

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
  displayProperty(
    `${oTokenSymbol} price`,
    `${oTokenSymbol}/${assetSymbol}`,
    price1,
    price1Before,
    6
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
  displayProperty(
    `${assetSymbol} price`,
    `${assetSymbol}/${oTokenSymbol}`,
    price2,
    price2Before,
    6
  );

  // Get the Strategy's Metapool LPs in the Convex pool
  const vaultLPsBefore =
    diffBlocks &&
    (await cvxRewardPool.balanceOf(strategyAddr, { blockTag: fromBlockTag }));
  const vaultLPs = await cvxRewardPool.balanceOf(strategyAddr, { blockTag });
  console.log(
    `\nvault Metapool LPs       : ${displayPortion(
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
  displayProperty(
    "Assets in vault",
    assetSymbol,
    assetsInVault,
    assetsInVaultBefore
  );
  // Vault's total value v total supply
  console.log("");
  displayProperty(
    "OToken total supply",
    oTokenSymbol,
    oTokenSupply,
    oTokenSupplyBefore
  );
  displayProperty(
    "vault assets value",
    assetSymbol,
    vaultTotalValue,
    vaultTotalValueBefore
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
  displayProperty(
    "OToken adjust supply",
    oTokenSymbol,
    vaultAdjustedTotalSupply,
    vaultAdjustedTotalSupplyBefore
  );
  displayProperty(
    "vault adjusted value",
    assetSymbol,
    vaultAdjustedTotalValue,
    vaultAdjustedTotalValueBefore
  );
  console.log(
    `adjusted value - supply  : ${displayRatio(
      vaultAdjustedTotalValue,
      vaultAdjustedTotalSupply,
      vaultAdjustedTotalValueBefore,
      vaultAdjustedTotalSupplyBefore
    )}`
  );

  // User balances
  if (taskArguments.user) {
    const user = taskArguments.user;

    // Report asset (ETH or 3CRV) balance
    const userAssetBalanceBefore =
      oTokenSymbol === "OETH"
        ? await hre.ethers.provider.getBalance(user, fromBlockTag)
        : await asset.balanceOf(user, { blockTag: fromBlockTag });
    const userAssetBalance =
      oTokenSymbol === "OETH"
        ? await hre.ethers.provider.getBalance(user, blockTag)
        : await asset.balanceOf(user, { blockTag });
    console.log("");
    displayProperty(
      "User asset balance",
      assetSymbol,
      userAssetBalance,
      userAssetBalanceBefore
    );

    const userOTokenBalanceBefore =
      diffBlocks && (await oToken.balanceOf(user, { blockTag: fromBlockTag }));
    const userOTokenBalance = await oToken.balanceOf(user, { blockTag });
    displayProperty(
      "User OToken balance",
      oTokenSymbol,
      userOTokenBalance,
      userOTokenBalanceBefore
    );
  }

  // Strategy's net minted and threshold
  const netMintedForStrategy = await vault.netOusdMintedForStrategy({
    blockTag,
  });
  const netMintedForStrategyThreshold =
    await vault.netOusdMintForStrategyThreshold({ blockTag });
  const netMintedForStrategyDiff =
    netMintedForStrategyThreshold.sub(netMintedForStrategy);
  console.log("");
  displayProperty("Net minted for strategy", assetSymbol, netMintedForStrategy);
  displayProperty(
    "Net minted threshold",
    assetSymbol,
    netMintedForStrategyThreshold
  );
  displayProperty(
    "Net minted for strat diff",
    assetSymbol,
    netMintedForStrategyDiff
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

function displayProperty(
  desc,
  unitDesc,
  currentValue,
  oldValue = false,
  decimals
) {
  console.log(
    `${desc.padEnd(25)}: ${formatUnits(currentValue)} ${unitDesc} ${displayDiff(
      oldValue != false,
      currentValue,
      oldValue,
      decimals
    )}`
  );
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
