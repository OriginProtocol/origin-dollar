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
  const blockTag =
    taskArguments.block === 0
      ? await hre.ethers.provider.getBlockNumber()
      : taskArguments.block;
  console.log(`block: ${blockTag}`);

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
  const poolBalances = await pool.get_balances({ blockTag });
  const virtualPrice = await pool.get_virtual_price({ blockTag });
  console.log(`LP virtual price: ${formatUnits(virtualPrice)} ${oTokenSymbol}`);

  // swap 1 OETH for ETH (OETH/ETH)
  const price1 = await pool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1"),
    { blockTag }
  );
  console.log(`${oTokenSymbol}/${assetSymbol} price : ${formatUnits(price1)}`);

  // swap 1 ETH for OETH (ETH/OETH)
  const price2 = await pool["get_dy(int128,int128,uint256)"](
    0,
    1,
    parseUnits("1"),
    { blockTag }
  );
  console.log(`${assetSymbol}/${oTokenSymbol} price : ${formatUnits(price2)}`);

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
  const ethBasisPoints = poolBalances[0].mul(1000000).div(totalBalances);
  const oethBasisPoints = poolBalances[1].mul(1000000).div(totalBalances);
  console.log(
    `\ntotal assets in pool     : ${formatUnits(
      poolBalances[0]
    )} ${assetSymbol} ${formatUnits(ethBasisPoints, 4)}%`
  );
  console.log(
    `total OTokens in pool    : ${formatUnits(
      poolBalances[1]
    )} ${oTokenSymbol} ${formatUnits(oethBasisPoints, 4)}%`
  );

  // Get vault value, supply
  const vaultTotalValue = await vault.totalValue({ blockTag });
  const oTokenSupply = await oToken.totalSupply({ blockTag });
  const strategyAssetsInPool = poolBalances[0].mul(vaultLPs).div(totalLPs);
  const strategyOTokensInPool = poolBalances[1].mul(vaultLPs).div(totalLPs);
  const vaultAdjustedTotalValue = vaultTotalValue.sub(strategyOTokensInPool);

  // Strategy's share of the assets in the pool
  const strategyAssets_v_VaultVault_BasisPoints = strategyAssetsInPool
    .mul(10000)
    .div(vaultAdjustedTotalValue);
  console.log(
    `\nassets owned by strategy : ${formatUnits(
      strategyAssetsInPool
    )} ${assetSymbol} ${formatUnits(
      strategyAssets_v_VaultVault_BasisPoints,
      2
    )}% of adjusted vault value`
  );

  // Strategy's share of the oTokens in the pool
  const strategyOTokens_v_Supply_BasisPoints = strategyOTokensInPool
    .mul(10000)
    .div(oTokenSupply);
  console.log(
    `OTokens owned by strategy: ${formatUnits(
      strategyOTokensInPool
    )} ${oTokenSymbol} ${formatUnits(
      strategyOTokens_v_Supply_BasisPoints,
      2
    )}% of OToken supply`
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

  // Adjusted strategy value = strategy assets value - strategy OTokens
  // Assume all OETH owned by the strategy will be burned after withdrawing
  // so are just left with the assets backing circulating OETH
  const strategyAdjustedValue = strategyAssetsValue.sub(strategyOTokensInPool);
  console.log(
    `\nstrategy adjusted value  : ${formatUnits(
      strategyAdjustedValue
    )} ${assetSymbol}`
  );
  const strategyOwnedVAdjustedValueDiff = strategyAssetsInPool.sub(
    strategyAdjustedValue
  );
  const strategyAdjustedValueVActualAssetsDiffBps = strategyAssetsInPool.gt(0)
    ? strategyOwnedVAdjustedValueDiff.mul(1000000).div(strategyAssetsInPool)
    : BigNumber.from(0);
  console.log(
    `owned v adjusted value   : ${formatUnits(
      strategyOwnedVAdjustedValueDiff
    )} ${assetSymbol} ${formatUnits(
      strategyAdjustedValueVActualAssetsDiffBps,
      4
    )}%`
  );

  // Vault's total value
  console.log(
    `\nOToken total supply      : ${formatUnits(oTokenSupply)} ${oTokenSymbol}`
  );
  console.log(
    `vault assets value       : ${formatUnits(vaultTotalValue)} ${assetSymbol}`
  );
  console.log(
    `vault adjusted value     : ${formatUnits(
      vaultAdjustedTotalValue
    )} ${assetSymbol}`
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

module.exports = {
  curvePool,
};
