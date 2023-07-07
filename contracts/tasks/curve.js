const { formatUnits, parseUnits } = require("ethers/lib/utils");

const poolAbi = require("../test/abi/ousdMetapool.json");
const addresses = require("../utils/addresses");
const { resolveAsset } = require("../utils/assets");
const { impersonateAndFund } = require("../utils/signers");

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
  const curveGaugeAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CurveOETHGauge
      : addresses.mainnet.CurveOUSDGauge;
  const convexRewardsPoolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CVXETHRewardsPool
      : addresses.mainnet.CVXRewardsPool;
  const poolLPSymbol = oTokenSymbol === "OETH" ? "OETHCRV-f" : "OUSD3CRV-f";
  const vaultAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHVaultProxy
      : addresses.mainnet.VaultProxy;
  // TODO condition to set to WETH or 3CRV
  const asset = await resolveAsset("WETH");

  // Load all the contracts
  const pool = await hre.ethers.getContractAt(poolAbi, poolAddr);
  const cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    convexRewardsPoolAddr
  );
  const amoStrategy = await ethers.getContractAt("IStrategy", strategyAddr);
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

  // Strategies redeemable asset amount
  // Note there is no Metapool fee as its a proportional withdraw
  const gauge = await impersonateAndFund(curveGaugeAddr);
  const strategyRedeemableAssets = await pool
    .connect(gauge)
    .callStatic["remove_liquidity(uint256,uint256[2],address)"](
      vaultLPs,
      [2, 3],
      strategyAddr,
      {
        blockTag,
      }
    );
  console.log(
    `strat redeemable assets  : ${formatUnits(
      strategyRedeemableAssets[0]
    )} ${assetSymbol}`
  );
  console.log(
    `strat redeemable OTokens : ${formatUnits(
      strategyRedeemableAssets[1]
    )} ${oTokenSymbol}`
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
  const strategyAdjustedValueVActualAssetsDiffBps =
    strategyOwnedVAdjustedValueDiff.mul(10000).div(strategyAssetsInPool);
  console.log(
    `owned v adjusted value   : ${formatUnits(
      strategyOwnedVAdjustedValueDiff
    )} ${assetSymbol} ${formatUnits(
      strategyAdjustedValueVActualAssetsDiffBps,
      2
    )}%`
  );

  const netMintedForStrategy = await vault.netOusdMintedForStrategy();
  const netMintedForStrategyThreshold =
    await vault.netOusdMintForStrategyThreshold();
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
