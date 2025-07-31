const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const addresses = require("../utils/addresses");
const { getSigner } = require("../utils/signers");
const { getDiffBlocks } = require("./block");
const { scaleAmount } = require("../utils/units");
const {
  curvePool,
  curveContracts,
  displayDiff,
  displayProperty,
  displayPortion,
  displayRatio,
} = require("./curve");
const { logTxDetails } = require("../utils/txLogger");

const log = require("../utils/logger")("task:curve");

/**
 * Hardhat task that dumps the current state of an AMO strategy
 */
async function amoStrategyTask(taskArguments) {
  const poolOTokenSymbol = taskArguments.pool;

  const output = taskArguments.output ? console.log : log;

  const { blockTag, fromBlockTag, diffBlocks } = await getDiffBlocks(
    taskArguments
  );

  const {
    totalLPsBefore,
    totalLPs,
    assetBalanceBefore,
    oTokenBalanceBefore,
    assetBalance,
    oTokenBalance,
  } = await curvePool({
    poolOTokenSymbol,
    diffBlocks,
    blockTag,
    fromBlockTag,
    output,
  });

  // Get symbols and contracts
  const {
    oTokenSymbol,
    assetSymbol,
    poolLPSymbol,
    asset,
    oToken,
    cvxRewardPool,
    amoStrategy,
    vault,
  } = await curveContracts(poolOTokenSymbol);

  // Strategy's Curve LPs in the Convex pool
  const vaultLPsBefore =
    diffBlocks &&
    (await cvxRewardPool.balanceOf(amoStrategy.address, {
      blockTag: fromBlockTag,
    }));
  const vaultLPs = await cvxRewardPool.balanceOf(amoStrategy.address, {
    blockTag,
  });
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
    diffBlocks && assetBalanceBefore.mul(vaultLPsBefore).div(totalLPsBefore);
  const strategyAssetsInPool = assetBalance.mul(vaultLPs).div(totalLPs);
  // OTokens in the pool
  const strategyOTokensInPoolBefore =
    diffBlocks && oTokenBalanceBefore.mul(vaultLPsBefore).div(totalLPsBefore);
  const strategyOTokensInPool = oTokenBalance.mul(vaultLPs).div(totalLPs);
  // Adjusted total vault value
  const vaultAdjustedTotalValueBefore =
    diffBlocks && vaultTotalValueBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalValue = vaultTotalValue.sub(strategyOTokensInPool);
  // Adjusted total supply of OTokens
  const vaultAdjustedTotalSupplyBefore =
    diffBlocks && oTokenSupplyBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalSupply = oTokenSupply.sub(strategyOTokensInPool);

  // Strategy's LPs in the Convex pool
  output(
    `\nStrategy's Curve LPs     : ${displayPortion(
      vaultLPs,
      totalLPs,
      poolLPSymbol,
      "total supply"
    )} ${displayDiff(diffBlocks, vaultLPs, vaultLPsBefore)}`
  );
  // Strategy's share of the assets in the pool
  output(
    `Assets owned by strategy : ${displayPortion(
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
  output(
    `OTokens owned by strategy: ${displayPortion(
      strategyOTokensInPool,
      vaultAdjustedTotalValue,
      oTokenSymbol,
      "adjusted vault value"
    )} ${displayDiff(
      diffBlocks,
      strategyOTokensInPool,
      strategyOTokensInPoolBefore
    )}`
  );
  const stratTotalInPool = strategyAssetsInPool.add(strategyOTokensInPool);
  output(`Both owned by strategy   : ${formatUnits(stratTotalInPool)}`);

  // Strategy asset values
  let totalStrategyAssetsValueBefore = BigNumber.from(0);
  let totalStrategyAssetsValue = BigNumber.from(0);
  const symbol = await asset.symbol();
  const strategyAssetsValueBefore =
    diffBlocks &&
    (await amoStrategy["checkBalance(address)"](asset.address, {
      blockTag: fromBlockTag,
    }));
  const strategyAssetsValueBeforeScaled =
    diffBlocks && (await scaleAmount(strategyAssetsValueBefore, asset));
  totalStrategyAssetsValueBefore =
    diffBlocks &&
    totalStrategyAssetsValueBefore.add(strategyAssetsValueBeforeScaled);
  const strategyAssetsValue = await amoStrategy["checkBalance(address)"](
    asset.address,
    {
      blockTag,
    }
  );
  const strategyAssetsValueScaled = await scaleAmount(
    strategyAssetsValue,
    asset
  );
  totalStrategyAssetsValue = totalStrategyAssetsValue.add(
    strategyAssetsValueScaled
  );
  output(
    `Strategy ${symbol.padEnd(4)} value      : ${displayPortion(
      strategyAssetsValueScaled,
      vaultTotalValue,
      symbol,
      "vault value"
    )} ${displayDiff(
      diffBlocks,
      strategyAssetsValueScaled,
      strategyAssetsValueBeforeScaled
    )}`
  );
  output(
    `Strategy total value     : ${displayPortion(
      totalStrategyAssetsValue,
      vaultTotalValue,
      assetSymbol,
      "vault value"
    )} ${displayDiff(
      diffBlocks,
      totalStrategyAssetsValue,
      totalStrategyAssetsValueBefore
    )}`
  );

  // Adjusted strategy value = strategy assets value - strategy OTokens
  // Assume all OETH owned by the strategy will be burned after withdrawing
  // so are just left with the assets backing circulating OETH
  const strategyAdjustedValueBefore =
    diffBlocks &&
    totalStrategyAssetsValueBefore.sub(strategyOTokensInPoolBefore);
  const strategyAdjustedValue = totalStrategyAssetsValue.sub(
    strategyOTokensInPool
  );
  output(
    `Strategy adjusted value  : ${displayPortion(
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
  output(
    `owned - adjusted value   : ${displayRatio(
      strategyAssetsInPool,
      strategyAdjustedValue,
      strategyAssetsInPoolBefore,
      strategyAdjustedValueBefore
    )}`
  );

  console.log("");
  const assetsInVaultBefore =
    diffBlocks &&
    (await asset.balanceOf(vault.address, {
      blockTag: fromBlockTag,
    }));
  const assetsInVaultBeforeScaled =
    diffBlocks && (await scaleAmount(assetsInVaultBefore, asset));
  const assetsInVault = await asset.balanceOf(vault.address, { blockTag });
  const assetsInVaultScaled = await scaleAmount(assetsInVault, asset);
  output(
    displayProperty(
      `${symbol.padEnd(4)} in vault`,
      symbol,
      assetsInVaultScaled,
      assetsInVaultBeforeScaled
    )
  );

  // Vault's total value v total supply
  output(
    displayProperty(
      "\nOToken total supply      ",
      oTokenSymbol,
      oTokenSupply,
      oTokenSupplyBefore
    )
  );
  output(
    displayProperty(
      "Vault assets value",
      assetSymbol,
      vaultTotalValue,
      vaultTotalValueBefore
    )
  );
  output(
    `Total value - supply     : ${displayRatio(
      vaultTotalValue,
      oTokenSupply,
      vaultTotalValueBefore,
      oTokenSupplyBefore
    )}`
  );
  // Adjusted total value v total supply
  output(
    displayProperty(
      "OToken adjust supply",
      oTokenSymbol,
      vaultAdjustedTotalSupply,
      vaultAdjustedTotalSupplyBefore
    )
  );
  output(
    displayProperty(
      "Vault adjusted value",
      assetSymbol,
      vaultAdjustedTotalValue,
      vaultAdjustedTotalValueBefore
    )
  );
  output(
    `Adjusted value - supply  : ${displayRatio(
      vaultAdjustedTotalValue,
      vaultAdjustedTotalSupply,
      vaultAdjustedTotalValueBefore,
      vaultAdjustedTotalSupplyBefore
    )}`
  );

  // Strategy's net minted and threshold
  const netMintedForStrategy = await vault.netOusdMintedForStrategy({
    blockTag,
  });
  const netMintedForStrategyThreshold =
    await vault.netOusdMintForStrategyThreshold({ blockTag });
  const netMintedForStrategyDiff =
    netMintedForStrategyThreshold.sub(netMintedForStrategy);

  output(
    displayProperty(
      "\nNet minted for strategy  ",
      assetSymbol,
      netMintedForStrategy
    )
  );
  output(
    displayProperty(
      "Net minted threshold",
      assetSymbol,
      netMintedForStrategyThreshold
    )
  );
  output(
    displayProperty(
      "Net minted for strat diff",
      assetSymbol,
      netMintedForStrategyDiff
    )
  );
}

/************************************
          AMO peg keeping
 ************************************/

async function mintAndAddOTokensTask(taskArguments) {
  const { amount, symbol } = taskArguments;

  // Get symbols and contracts
  const amoStrategyAddr =
    symbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.ConvexOUSDAMOStrategy;
  const amoStrategy = await ethers.getContractAt(
    "ConvexEthMetaStrategy",
    amoStrategyAddr
  );

  const signer = await getSigner();

  const amountUnits = parseUnits(amount.toString());
  log(`Minting ${formatUnits(amountUnits)} ${symbol} and adding to Curve pool`);

  const tx = await amoStrategy.connect(signer).mintAndAddOTokens(amountUnits);
  await logTxDetails(tx, "mintAndAddOTokens");
}

async function removeAndBurnOTokensTask(taskArguments) {
  const { amount, symbol } = taskArguments;

  // Get symbols and contracts
  const amoStrategyAddr =
    symbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.ConvexOUSDAMOStrategy;
  const amoStrategy = await ethers.getContractAt(
    "ConvexEthMetaStrategy",
    amoStrategyAddr
  );

  const signer = await getSigner();

  const amountUnits = parseUnits(amount.toString());
  log(
    `Remove OTokens using ${formatUnits(
      amountUnits
    )} ${symbol} Curve LP tokens and burn the OTokens`
  );

  const tx = await amoStrategy
    .connect(signer)
    .removeAndBurnOTokens(amountUnits);
  await logTxDetails(tx, "removeAndBurnOTokens");
}

async function removeOnlyAssetsTask(taskArguments) {
  const { amount, symbol } = taskArguments;

  // Get symbols and contracts
  const amoStrategyAddr =
    symbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.ConvexOUSDAMOStrategy;
  const amoStrategy = await ethers.getContractAt(
    "ConvexEthMetaStrategy",
    amoStrategyAddr
  );

  const signer = await getSigner();

  const amountUnits = parseUnits(amount.toString());
  log(
    `Remove ETH using ${formatUnits(
      amountUnits
    )} ${symbol} Curve LP tokens and add to ${symbol} Vault`
  );

  const tx = await amoStrategy.connect(signer).removeOnlyAssets(amountUnits);
  await logTxDetails(tx, "removeOnlyAssets");
}

module.exports = {
  amoStrategyTask,
  mintAndAddOTokensTask,
  removeAndBurnOTokensTask,
  removeOnlyAssetsTask,
  curveContracts,
  displayDiff,
  displayPortion,
  displayProperty,
  displayRatio,
};
