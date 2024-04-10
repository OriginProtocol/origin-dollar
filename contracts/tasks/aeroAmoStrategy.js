const { formatUnits, parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const addresses = require("../utils/addresses");
const { getSigner } = require("../utils/signers");
const { getDiffBlocks } = require("./block");
const { scaleAmount } = require("../utils/units");
const {
  aeroPool,
  aeroContracts,
  displayDiff,
  displayProperty,
  displayPortion,
  displayRatio,
} = require("./aerodrome");

const log = require("../utils/logger")("task:aero");

/**
 * hardhat task that dumps the current state of a Aero AMO Strategy
 */
async function aeroAmoStrategyTask(taskArguments, hre) {
  const poolOTokenSymbol = taskArguments.pool;

  const fixture = JSON.parse(taskArguments.fixture);
  taskArguments.fixture = fixture;
  const output = taskArguments.output ? console.log : log;

  const { blockTag, fromBlockTag, diffBlocks } = await getDiffBlocks(
    taskArguments,
    hre
  );

  const { totalLPsBefore, totalLPs, poolBalancesBefore, poolBalances } =
    await aeroPool({
      poolOTokenSymbol,
      fixture,
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
    assets,
    oToken,
    gauge,
    amoStrategy,
    vault,
  } = await aeroContracts(poolOTokenSymbol, fixture);

  // Strategy's Metapool LPs in the Gauge
  const vaultLPsBefore =
    diffBlocks &&
    (await gauge.balanceOf(amoStrategy.address, {
      blockTag: fromBlockTag,
    }));
  const vaultLPs = await gauge.balanceOf(amoStrategy.address, {
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
    diffBlocks &&
    poolBalancesBefore[fixture.wethReserveIndex]
      .mul(vaultLPsBefore)
      .div(totalLPsBefore);
  const strategyAssetsInPool = poolBalances[fixture.wethReserveIndex]
    .mul(vaultLPs)
    .div(totalLPs);
  // OTokens in the pool
  const strategyOTokensInPoolBefore =
    diffBlocks &&
    poolBalancesBefore[fixture.oethReserveIndex]
      .mul(vaultLPsBefore)
      .div(totalLPsBefore);
  const strategyOTokensInPool = poolBalances[fixture.oethReserveIndex]
    .mul(vaultLPs)
    .div(totalLPs);
  //  Adjusted total vault value
  const vaultAdjustedTotalValueBefore =
    diffBlocks && vaultTotalValueBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalValue = vaultTotalValue.sub(strategyOTokensInPool);
  // Adjusted total supply of OTokens
  const vaultAdjustedTotalSupplyBefore =
    diffBlocks && oTokenSupplyBefore.sub(strategyOTokensInPoolBefore);
  const vaultAdjustedTotalSupply = oTokenSupply.sub(strategyOTokensInPool);

  // Strategy's Metapool LPs in the Convex pool
  output(
    `\nvault Metapool LPs       : ${displayPortion(
      vaultLPs,
      totalLPs,
      poolLPSymbol,
      "total supply"
    )} ${displayDiff(diffBlocks, vaultLPs, vaultLPsBefore)}`
  );
  // Strategy's share of the assets in the pool
  output(
    `assets owned by strategy : ${displayPortion(
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
      "OToken supply"
    )} ${displayDiff(
      diffBlocks,
      strategyOTokensInPool,
      strategyOTokensInPoolBefore
    )}`
  );
  const stratTotalInPool = strategyAssetsInPool.add(strategyOTokensInPool);
  output(`both owned by strategy   : ${formatUnits(stratTotalInPool)}`);

  // Strategy asset values
  let totalStrategyAssetsValueBefore = BigNumber.from(0);
  let totalStrategyAssetsValue = BigNumber.from(0);

  for (const asset of assets) {
    const symbol = "WETH";
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

    asset.decimals = () => {
      return 18;
    };

    const strategyAssetsValueScaled = await scaleAmount(
      strategyAssetsValue,
      asset
    );
    totalStrategyAssetsValue = totalStrategyAssetsValue.add(
      strategyAssetsValueScaled
    );
    output(
      `strategy ${symbol.padEnd(4)} value      : ${displayPortion(
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
  }
  output(
    `strategy total value     : ${displayPortion(
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
  output(
    `owned - adjusted value   : ${displayRatio(
      strategyAssetsInPool,
      strategyAdjustedValue,
      strategyAssetsInPoolBefore,
      strategyAdjustedValueBefore
    )}`
  );

  for (const asset of assets) {
    const assetsInVaultBefore =
      diffBlocks &&
      (await asset.balanceOf(vault.address, {
        blockTag: fromBlockTag,
      }));
    const assetsInVaultBeforeScaled =
      diffBlocks && (await scaleAmount(assetsInVaultBefore, asset));
    const assetsInVault = await asset.balanceOf(vault.address, { blockTag });
    const assetsInVaultScaled = await scaleAmount(assetsInVault, asset);
    const symbol = "WETH";
    output(
      displayProperty(
        `${symbol.padEnd(4)} in vault`,
        symbol,
        assetsInVaultScaled,
        assetsInVaultBeforeScaled
      )
    );
  }
  // Vault's total value v total supply
  output(
    displayProperty(
      "\nOToken total supply",
      oTokenSymbol,
      oTokenSupply,
      oTokenSupplyBefore
    )
  );
  output(
    displayProperty(
      "vault assets value",
      assetSymbol,
      totalStrategyAssetsValue,
      totalStrategyAssetsValueBefore
    )
  );
  output(
    `total value - supply     : ${displayRatio(
      totalStrategyAssetsValue,
      oTokenSupply,
      totalStrategyAssetsValueBefore,
      oTokenSupplyBefore
    )}`
  );
  //  Adjusted total value v total supply
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
      "vault adjusted value",
      assetSymbol,
      vaultAdjustedTotalValue,
      vaultAdjustedTotalValueBefore
    )
  );
  output(
    `adjusted value - supply  : ${displayRatio(
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
  //   const netMintedForStrategyThreshold =
  //     await vault.netOusdMintForStrategyThreshold({ blockTag });
  //   const netMintedForStrategyDiff =
  //     netMintedForStrategyThreshold.sub(netMintedForStrategy);

  output(
    displayProperty(
      "\nNet minted for strategy",
      assetSymbol,
      netMintedForStrategy
    )
  );
  //   output(
  //     displayProperty(
  //       "Net minted threshold",
  //       assetSymbol,
  //       netMintedForStrategyThreshold
  //     )
  //   );
  //   output(
  //     displayProperty(
  //       "Net minted for strat diff",
  //       assetSymbol,
  //       netMintedForStrategyDiff
  //     )
  // );
}

module.exports = {
  aeroAmoStrategyTask,
  aeroContracts,
  displayDiff,
  displayPortion,
  displayProperty,
  displayRatio,
};
