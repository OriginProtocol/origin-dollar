const { BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const { getBlock } = require("./block");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");

async function snapIchiVault({ block, id }) {
  const blockTag = getBlock(block);

  const vault = await resolveContract(
    addresses.sonic[`ichiVault${id}`],
    "IICHIVault"
  );

  const token0 = await ethers.getContractAt(
    "IERC20Metadata",
    await vault.token0()
  );
  const token1 = await ethers.getContractAt(
    "IERC20Metadata",
    await vault.token1()
  );

  const baseLower = await vault.baseLower({
    blockTag,
  });
  const baseUpper = await vault.baseUpper({
    blockTag,
  });
  const limitLower = await vault.limitLower({
    blockTag,
  });
  const limitUpper = await vault.limitUpper({
    blockTag,
  });
  const basePositionId = await vault.basePositionId({
    blockTag,
  });
  const limitPositionId = await vault.limitPositionId({
    blockTag,
  });

  // Get base amounts
  const {
    // eslint-disable-next-line no-unused-vars
    baseLiquidity,
    amount0: baseAmount0,
    amount1: baseAmount1,
  } = await vault.getBasePosition({
    blockTag,
  });
  const totalBaseAmount = baseAmount0.add(baseAmount1);

  // Get limit amounts
  const {
    // eslint-disable-next-line no-unused-vars
    limitLiquidity,
    amount0: limitAmount0,
    amount1: limitAmount1,
  } = await vault.getLimitPosition({
    blockTag,
  });
  const totalLimitAmount = limitAmount0.add(limitAmount1);

  // Get total amounts
  const { amount0: totalAmount0, amount1: totalAmount1 } =
    await vault.getTotalAmounts({
      blockTag,
    });
  const totalAmounts = totalAmount0.add(totalAmount1);

  console.log(`Vault   : ${await vault.symbol()}`);
  console.log(
    `token 0 : ${await token0.symbol()} ${await vault.allowToken0()}`
  );
  console.log(
    `token 1 : ${await token1.symbol()} ${await vault.allowToken1()}`
  );
  console.log(`current tick : ${await vault.currentTick()}`);

  console.log("\nBase");
  console.log(`upper    : ${baseUpper}`);
  console.log(`lower    : ${baseLower}`);
  console.log(`pos id   : ${basePositionId}`);
  console.log(
    `${formatUnits(baseAmount0)} ${await token0.symbol()}, ${displayPercentage(
      baseAmount0,
      totalBaseAmount
    )} of base, ${displayPercentage(baseAmount0, totalAmounts)} of total`
  );
  console.log(
    `${formatUnits(baseAmount1)} ${await token1.symbol()}, ${displayPercentage(
      baseAmount1,
      totalBaseAmount
    )} of base, ${displayPercentage(baseAmount1, totalAmounts)} of total`
  );
  console.log(
    `${formatUnits(totalBaseAmount)} total, ${displayPercentage(
      totalBaseAmount,
      totalAmounts
    )} of total`
  );

  console.log("\nLimit");
  console.log(`upper    : ${limitUpper}`);
  console.log(`lower    : ${limitLower}`);
  console.log(`pos id   : ${limitPositionId}`);
  console.log(
    `${formatUnits(limitAmount0)} ${await token0.symbol()} ${displayPercentage(
      limitAmount0,
      totalLimitAmount
    )} of limit, ${displayPercentage(limitAmount0, totalAmounts)} of total`
  );
  console.log(
    `${formatUnits(limitAmount1)} ${await token1.symbol()} ${displayPercentage(
      limitAmount1,
      totalLimitAmount
    )} of limit, ${displayPercentage(limitAmount1, totalAmounts)} of total`
  );
  console.log(
    `${formatUnits(totalLimitAmount)} total, ${displayPercentage(
      totalLimitAmount,
      totalAmounts
    )} of total`
  );

  console.log("\nTotals");
  console.log(
    `${formatUnits(totalAmount0)} ${await token0.symbol()} ${displayPercentage(
      totalAmount0,
      totalAmounts
    )}`
  );
  console.log(
    `${formatUnits(totalAmount1)} ${await token1.symbol()} ${displayPercentage(
      totalAmount1,
      totalAmounts
    )}`
  );
}

function displayPercentage(value, total, precision = 2) {
  // Calculate the percentage difference
  const percentage = value
    .mul(BigNumber.from(10).pow(2 + precision))
    .div(total);

  // Convert to a string
  return `${formatUnits(percentage, precision)}%`;
}

module.exports = {
  snapIchiVault,
};
