const { BigNumber } = require("ethers");
const { formatUnits, parseUnits } = require("ethers/lib/utils");
const addresses = require("../utils/addresses");
const { resolveAsset } = require("../utils/assets");
const { getDiffBlocks } = require("./block");

const log = require("../utils/logger")("task:aerodrome");

/**
 * Hardhat task to dump the current state of a Aerodrome sAMM pool used for AMO
 */
async function aeroPoolTask(taskArguments, hre) {
  const poolOTokenSymbol = taskArguments.pool;
  const fixture = taskArguments.fixture;
  const output = taskArguments.output ? console.log : log;

  const { blockTag, fromBlockTag, diffBlocks } = await getDiffBlocks(
    taskArguments,
    hre
  );
  await aeroPool({
    poolOTokenSymbol,
    fixture,
    diffBlocks,
    blockTag,
    fromBlockTag,
    output,
  });
}

async function aeroPool({
  poolOTokenSymbol,
  fixture,
  diffBlocks = false,
  blockTag,
  fromBlockTag,
  output = console.log,
}) {
  // Get symbols and contracts
  const { oTokenSymbol, assetSymbol, poolLPSymbol, pool, router } =
    await aeroContracts(poolOTokenSymbol, fixture);

  // Get Metapool data
  const totalLPsBefore =
    diffBlocks && (await pool.totalSupply({ blockTag: fromBlockTag }));
  const totalLPs = await pool.totalSupply({ blockTag });
  const virtualPriceBefore = diffBlocks && (await calcLPTokenPrice(fixture));
  const virtualPrice = await calcLPTokenPrice(fixture);
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
  const poolBalancesBefore =
    diffBlocks && (await pool.getReserves({ blockTag: fromBlockTag }));
  const poolBalances = await pool.getReserves({ blockTag });

  const amountOutBefore = await router.getAmountsOut(parseUnits("1"), [
    [
      fixture.oeth.address,
      fixture.weth.address,
      true,
      addresses.base.aeroFactoryAddress,
    ],
  ]);

  // swap 1 OETH for ETH (OETH/ETH)
  const price1Before = diffBlocks && amountOutBefore[1];

  const price1 = (
    await router.getAmountsOut(parseUnits("1"), [
      [
        fixture.oeth.address,
        fixture.weth.address,
        true,
        addresses.base.aeroFactoryAddress,
      ],
    ])
  )[1];

  output(
    displayProperty(
      `${oTokenSymbol} price`,
      `${oTokenSymbol}/${assetSymbol}`,
      price1,
      price1Before,
      6
    )
  );

  // swap 1 ETH for OETH (ETH/OETH)
  const price2Before =
    diffBlocks &&
    (
      await router.getAmountsOut(parseUnits("1"), [
        [
          fixture.weth.address,
          fixture.oeth.address,
          true,
          addresses.base.aeroFactoryAddress,
        ],
      ])
    )[1];
  const price2 = (
    await router.getAmountsOut(parseUnits("1"), [
      [
        fixture.weth.address,
        fixture.oeth.address,
        true,
        addresses.base.aeroFactoryAddress,
      ],
    ])
  )[1];
  output(
    displayProperty(
      `${assetSymbol} price`,
      `${assetSymbol}/${oTokenSymbol}`,
      price2,
      price2Before,
      6
    )
  );

  // Total Metapool assets
  const totalBalances = poolBalances._reserve0.add(poolBalances._reserve1);
  output(
    `total assets in pool     : ${displayPortion(
      poolBalances[fixture.wethReserveIndex],
      totalBalances,
      assetSymbol,
      "pool",
      4
    )} ${displayDiff(
      diffBlocks,
      poolBalances[fixture.wethReserveIndex],
      poolBalancesBefore[fixture.wethReserveIndex]
    )}`
  );
  output(
    `total OTokens in pool    : ${displayPortion(
      poolBalances[fixture.oethReserveIndex],
      totalBalances,
      oTokenSymbol,
      "pool",
      4
    )} ${displayDiff(
      diffBlocks,
      poolBalances[fixture.oethReserveIndex],
      poolBalancesBefore[fixture.oethReserveIndex]
    )}`
  );

  return {
    totalLPsBefore,
    totalLPs,
    poolBalancesBefore,
    poolBalances,
    totalBalances,
  };
}

async function aeroContracts(oTokenSymbol, fixture) {
  // Get symbols of tokens in the pool
  const assetSymbol = oTokenSymbol === "OETH" ? "WETH " : "USD";

  const poolLPSymbol = "Stable AMM - WETH/OETH";

  // Load all the contracts
  const assets =
    oTokenSymbol === "OETH"
      ? [await ethers.getContractAt("IERC20", fixture.weth.address)]
      : [
          await resolveAsset("DAI"),
          await resolveAsset("USDC"),
          await resolveAsset("USDT"),
        ];
  fixture.pool = await ethers.getContractAt("IPool", fixture.pool.address);
  fixture.gauge = await ethers.getContractAt(
    "IGauge",
    fixture.aeroGauge.address
  );
  fixture.aerodromeEthStrategy = await ethers.getContractAt(
    "AerodromeEthStrategy",
    fixture.aerodromeEthStrategy.address
  );
  fixture.oeth = await ethers.getContractAt("IERC20", fixture.oeth.address);
  fixture.oethVault = await ethers.getContractAt(
    "IVault",
    fixture.oethVault.address
  );
  fixture.aeroRouter = await ethers.getContractAt(
    "IRouter",
    addresses.base.aeroRouterAddress
  );

  return {
    oTokenSymbol,
    assetSymbol,
    poolLPSymbol,
    pool: fixture.pool,
    gauge: fixture.gauge,
    amoStrategy: fixture.aerodromeEthStrategy,
    oToken: fixture.oeth,
    assets,
    vault: fixture.oethVault,
    router: fixture.aeroRouter,
  };
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
  const basisPoints =
    amount.gt(0) && total.gt(0)
      ? amount.mul(BigNumber.from(10).pow(2 + precision)).div(total)
      : BigNumber.from(0);
  return `${formatUnits(amount)} ${units} ${formatUnits(
    basisPoints,
    precision
  )}%${comparison ? " of " + comparison : ""}`;
}

function displayRatio(a, b, aBefore, bBefore, precision = 6) {
  const diff = a.sub(b);
  const diffPercentage =
    a.gt(0) && b.gt(0)
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

function sqrt(value) {
  const ONE = ethers.BigNumber.from(1);
  const TWO = ethers.BigNumber.from(2);
  let x = ethers.BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

// Calculate the LPToken price of the given sAMM pool
async function calcLPTokenPrice(fixture) {
  const { pool } = fixture;

  // Get the ETH and OETH balances in the Aero sAMM Pool
  const aeroBalances = await pool.getReserves();
  const x = aeroBalances._reserve0;
  const y = aeroBalances._reserve1;

  // price = 2 * fourthroot of (invariant/2)
  const lpPrice =
    2 *
    sqrt(sqrt(x.pow(3).mul(y).add(y.pow(3).mul(x)).div(2))).div(
      await pool.totalSupply()
    );

  log(`LP Price :  ${lpPrice} `);

  return BigNumber.from(lpPrice).mul(ethers.constants.WeiPerEther);
}

module.exports = {
  aeroContracts,
  aeroPool,
  aeroPoolTask,
  displayDiff,
  displayProperty,
  displayPortion,
  displayRatio,
};
