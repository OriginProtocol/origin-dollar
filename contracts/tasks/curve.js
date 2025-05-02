const { BigNumber } = require("ethers");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const curveNGPoolAbi = require("../test/abi/curveStableSwapNG.json");
const oethPoolAbi = require("../test/abi/oethMetapool.json");
const addresses = require("../utils/addresses");
const { resolveAsset } = require("../utils/resolvers");
const { getDiffBlocks } = require("./block");
const { getSigner } = require("../utils/signers");

const log = require("../utils/logger")("task:curve");

/**
 * Hardhat task to dump the current state of a Curve Metapool pool used for AMO
 */
async function curvePoolTask(taskArguments) {
  const poolOTokenSymbol = taskArguments.pool;

  const output = taskArguments.output ? console.log : log;

  const { blockTag, fromBlockTag, diffBlocks } = await getDiffBlocks(
    taskArguments
  );

  await curvePool({
    poolOTokenSymbol,
    diffBlocks,
    blockTag,
    fromBlockTag,
    output,
  });
}

/**
 * Dumps the current state of a Curve Metapool pool used for AMO
 */
async function curvePool({
  poolOTokenSymbol,
  diffBlocks = false,
  blockTag,
  fromBlockTag,
  output = console.log,
}) {
  // Get symbols and contracts
  const { oTokenSymbol, assetSymbol, poolLPSymbol, pool } =
    await curveContracts(poolOTokenSymbol);

  // Get pool data
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

  output(
    displayProperty(
      "Pool LP total supply",
      poolLPSymbol,
      totalLPs,
      totalLPsBefore,
      6
    )
  );

  output(displayProperty("Invariant (D) ", "", invariant, invariantBefore, 6));

  output(
    displayProperty(
      "LP virtual price",
      assetSymbol,
      virtualPrice,
      virtualPriceBefore,
      6
    )
  );

  // Pool balances
  let poolBalancesBefore =
    diffBlocks &&
    (await pool.get_balances({
      blockTag: fromBlockTag,
    }));
  // let poolBalances = await pool.get_balances({ blockTag });
  let poolBalances = await pool.get_balances();
  if (oTokenSymbol === "OUSD") {
    // scale up the USDC balance to 18 decimals
    poolBalancesBefore = poolBalancesBefore
      ? [poolBalancesBefore[0], poolBalancesBefore[1].mul(parseUnits("1", 12))]
      : [];
    poolBalances = [poolBalances[0], poolBalances[1].mul(parseUnits("1", 12))];
  }
  const assetBalanceBefore =
    diffBlocks &&
    (oTokenSymbol === "OETH" ? poolBalancesBefore[0] : poolBalancesBefore[1]);
  const oTokenBalanceBefore =
    diffBlocks &&
    (oTokenSymbol === "OETH" ? poolBalancesBefore[1] : poolBalancesBefore[0]);
  const assetBalance =
    oTokenSymbol === "OETH" ? poolBalances[0] : poolBalances[1];
  const oTokenBalance =
    oTokenSymbol === "OETH" ? poolBalances[1] : poolBalances[0];

  const price1Before =
    diffBlocks &&
    (oTokenSymbol === "OETH"
      ? // swap 1 OETH for ETH (OETH/ETH)
        await pool["get_dy(int128,int128,uint256)"](1, 0, parseUnits("1"), {
          blockTag: fromBlockTag,
        })
      : // swap 1 OUSD for USDC (OUSD/USDC) scaled to 18 decimals
        (
          await pool["get_dy(int128,int128,uint256)"](0, 1, parseUnits("1"), {
            blockTag,
          })
        ).mul(parseUnits("1", 12)));
  const price1 =
    oTokenSymbol === "OETH"
      ? // swap 1 OETH for ETH (OETH/ETH)
        await pool["get_dy(int128,int128,uint256)"](1, 0, parseUnits("1"), {
          blockTag,
        })
      : // swap 1 OUSD for USDC (OUSD/USDC) scaled to 18 decimals
        (
          await pool["get_dy(int128,int128,uint256)"](0, 1, parseUnits("1"), {
            blockTag,
          })
        ).mul(parseUnits("1", 12));

  output(
    displayProperty(
      `${oTokenSymbol} sell price`,
      `${oTokenSymbol}/${assetSymbol}`,
      price1,
      price1Before,
      6
    )
  );

  // swap 1 ETH for OETH (ETH/OETH)
  const price2Before =
    diffBlocks &&
    (oTokenSymbol === "OETH"
      ? await pool["get_dy(int128,int128,uint256)"](0, 1, parseUnits("1"), {
          blockTag: fromBlockTag,
        })
      : // swap 1 USDC for OUSD (USDC/OUSD)
        await pool["get_dy(int128,int128,uint256)"](1, 0, parseUnits("1", 6), {
          blockTag: fromBlockTag,
        }));
  const price2 =
    oTokenSymbol === "OETH"
      ? await pool["get_dy(int128,int128,uint256)"](0, 1, parseUnits("1"), {
          blockTag,
        })
      : // swap 1 USDC for OUSD (USDC/OUSD)
        await pool["get_dy(int128,int128,uint256)"](1, 0, parseUnits("1", 6), {
          blockTag,
        });
  const buyPriceBefore = diffBlocks && parseUnits("1", 36).div(price2Before);
  const buyPrice = parseUnits("1", 36).div(price2);

  output(
    displayProperty(
      `${oTokenSymbol} buy price`,
      `${oTokenSymbol}/${assetSymbol}`,
      buyPrice,
      buyPriceBefore,
      6
    )
  );

  // Total pool assets
  const totalBalances = assetBalance.add(oTokenBalance);
  const excessAssetsBefore =
    diffBlocks &&
    (oTokenBalanceBefore.gt(assetBalanceBefore)
      ? oTokenBalanceBefore.sub(assetBalanceBefore)
      : assetBalanceBefore.sub(oTokenBalanceBefore));
  const excessAssets = oTokenBalance.gt(assetBalance)
    ? oTokenBalance.sub(assetBalance)
    : assetBalance.sub(oTokenBalance);
  const excessAssetsSymbol = oTokenBalance.gt(assetBalance)
    ? oTokenSymbol
    : assetSymbol;
  output(
    `Total assets in pool     : ${displayPortion(
      assetBalance,
      totalBalances,
      assetSymbol,
      "pool",
      4
    )} ${displayDiff(diffBlocks, poolBalances[0], assetBalanceBefore)}`
  );
  output(
    `Total OTokens in pool    : ${displayPortion(
      oTokenBalance,
      totalBalances,
      oTokenSymbol,
      "pool",
      4
    )} ${displayDiff(diffBlocks, oTokenBalance, oTokenBalanceBefore)}`
  );
  output(
    displayProperty(
      `Excess assets`,
      `${excessAssetsSymbol}`,
      excessAssets,
      excessAssetsBefore,
      4
    )
  );

  return {
    totalLPsBefore,
    totalLPs,
    poolBalancesBefore,
    assetBalanceBefore,
    oTokenBalanceBefore,
    poolBalances,
    assetBalance,
    oTokenBalance,
    totalBalances,
  };
}

/************************************
    Curve functions that write
 ************************************/

async function curveAddTask(taskArguments) {
  const { assets, min, otokens, slippage, symbol } = taskArguments;

  // Get symbols and contracts
  const { assetSymbol, oTokenSymbol, oToken, pool, poolLPSymbol } =
    await curveContracts(symbol);

  const signer = await getSigner();
  const signerAddress = await signer.getAddress();

  const oTokenAmount = parseUnits(otokens.toString());
  const assetAmount = parseUnits(assets.toString());
  log(
    `Adding ${formatUnits(oTokenAmount)} ${oTokenSymbol} and ${formatUnits(
      assetAmount
    )} ${assetSymbol} to ${poolLPSymbol}`
  );

  const assetBalance = await hre.ethers.provider.getBalance(signerAddress);
  const oTokenBalance = await oToken.balanceOf(signerAddress);
  log(
    `Signer balances ${signerAddress}\n${formatUnits(
      assetBalance
    )} ${assetSymbol}`
  );
  log(`${formatUnits(oTokenBalance)} ${oTokenSymbol}`);

  let minLpTokens;
  if (min != undefined) {
    minLpTokens = parseUnits(min.toString());
  } else {
    const virtualPrice = await pool.get_virtual_price();
    // 3Crv = USD / virtual price
    const estimatedLpTokens = oTokenAmount.add(assetAmount).div(virtualPrice);
    const slippageScaled = slippage * 100;
    minLpTokens = estimatedLpTokens.mul(10000 - slippageScaled).div(10000);
  }
  log(`min LP tokens: ${formatUnits(minLpTokens)}`);

  if (oTokenAmount.gt(0)) {
    await oToken.connect(signer).approve(pool.address, oTokenAmount);
  }

  const override = oTokenSymbol === "OETH" ? { value: assetAmount } : {};
  // prettier-ignore
  const tx = await pool
    .connect(signer)["add_liquidity(uint256[2],uint256)"](
      [assetAmount, oTokenAmount],
      minLpTokens, override
    );

  // get event data
  const receipt = await tx.wait();
  log(`${receipt.events.length} events emitted`);
  const event = receipt.events?.find((e) => e.event === "AddLiquidity");
  log(`invariant ${formatUnits(event.args.invariant)}`);
  log(
    `fees ${formatUnits(event.args.fees[0])} ${assetSymbol} ${formatUnits(
      event.args.fees[1]
    )} ${oTokenSymbol}`
  );
  log(`token_supply ${formatUnits(event.args.token_supply)}`);
}

async function curveRemoveTask(taskArguments) {
  const { assets, otokens, slippage, symbol } = taskArguments;

  // Get symbols and contracts
  const { assetSymbol, oTokenSymbol, oToken, pool, poolLPSymbol } =
    await curveContracts(symbol);

  const signer = await getSigner();

  const oTokenAmount = parseUnits(otokens.toString());
  const assetAmount = parseUnits(assets.toString());
  log(
    `Adding ${formatUnits(oTokenAmount)} ${oTokenSymbol} and ${formatUnits(
      assetAmount
    )} ${assetSymbol} to ${poolLPSymbol}`
  );

  const virtualPrice = await pool.get_virtual_price();
  // 3Crv = USD / virtual price
  const estimatedLpTokens = oTokenAmount.add(assetAmount).div(virtualPrice);
  const slippageScaled = slippage * 100;
  const maxLpTokens = estimatedLpTokens.mul(10000 + slippageScaled).div(10000);
  console.log(`min LP tokens: ${formatUnits(maxLpTokens)}`);

  if (oTokenAmount.gt(0)) {
    await oToken.connect(signer).approve(pool.address, oTokenAmount);
  }

  const override = oTokenSymbol === "OETH" ? { value: assetAmount } : {};
  // prettier-ignore
  await pool
    .connect(signer)["remove_liquidity_imbalance(uint256[2],uint256)"](
      [assetAmount, oTokenAmount],
      maxLpTokens, override
    );

  // TODO get LPs burned
}

async function curveSwapTask(taskArguments) {
  const { amount, from, min, symbol } = taskArguments;

  // Get symbols and contracts
  const { pool } = await curveContracts(symbol);

  const signer = await getSigner();

  const fromAmount = parseUnits(amount.toString());
  const minAmount = parseUnits(min.toString());

  const fromIndex = from === "ETH" || from === "3CRV" ? 0 : 1;
  const toIndex = from === "ETH" || from === "3CRV" ? 1 : 0;

  const override = from === "ETH" ? { value: amount } : {};

  log(
    `Swapping ${formatUnits(
      fromAmount
    )} ${from} from index ${fromIndex} to index ${toIndex}`
  );
  // prettier-ignore
  await pool
    .connect(signer)["exchange(int128,int128,uint256,uint256)"](
          fromIndex,
          toIndex,
          fromAmount,
          minAmount,
          override
    );

  // TODO get LPs burned
}

async function curveContracts(oTokenSymbol) {
  // Get symbols of tokens in the pool
  const assetSymbol = oTokenSymbol === "OETH" ? "ETH " : "USDC";

  // Get the contract addresses
  const poolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CurveOETHMetaPool
      : addresses.mainnet.curve.OUSD_USDC.pool;
  log(`Resolved ${oTokenSymbol} Curve pool to ${poolAddr}`);
  const strategyAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.ConvexOETHAMOStrategy
      : addresses.mainnet.CurveOUSDAMOStrategy;
  const convexRewardsPoolAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.CVXETHRewardsPool
      : addresses.mainnet.curve.OUSD_USDC.gauge;
  const poolLPSymbol = oTokenSymbol === "OETH" ? "OETHCRV-f" : "OUSD/USDC";
  const vaultAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHVaultProxy
      : addresses.mainnet.VaultProxy;
  const oTokenAddr =
    oTokenSymbol === "OETH"
      ? addresses.mainnet.OETHProxy
      : addresses.mainnet.OUSDProxy;

  // Load all the contracts
  const asset =
    oTokenSymbol === "OETH"
      ? await resolveAsset("WETH")
      : await resolveAsset("USDC");
  const pool =
    oTokenSymbol === "OETH"
      ? await hre.ethers.getContractAt(oethPoolAbi, poolAddr)
      : await hre.ethers.getContractAt(curveNGPoolAbi, poolAddr);
  const cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    convexRewardsPoolAddr
  );
  const amoStrategy = await ethers.getContractAt("IStrategy", strategyAddr);
  const oToken = await ethers.getContractAt("IERC20", oTokenAddr);
  const vault = await ethers.getContractAt("IVault", vaultAddr);

  return {
    oTokenSymbol,
    assetSymbol,
    poolLPSymbol,
    pool,
    cvxRewardPool,
    amoStrategy,
    oToken,
    asset,
    vault,
  };
}

function displayDiff(diffBlocks, newValue, oldValue, precision = 2) {
  if (!diffBlocks) return "";
  // Calculate the difference between the new and old value
  const diff = newValue.sub(oldValue);
  // Calculate the percentage difference if the old value is not zero
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
  return `${desc.padEnd(25)}: ${formatUnits(
    currentValue
  )} ${unitDesc} ${displayDiff(
    oldValue != false,
    currentValue,
    oldValue,
    decimals
  )}`;
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
  curvePoolTask,
  curveAddTask,
  curveRemoveTask,
  curveSwapTask,
  curveContracts,
  displayDiff,
  displayProperty,
  displayPortion,
  displayRatio,
};
