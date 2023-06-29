const { formatUnits, parseUnits } = require("ethers/lib/utils");

const logModule = "utils:curve";
const log = require("./logger")(logModule);

/**
 *
 * @param {*} pool Curve pool contract
 * @param {*} coin0 token symbol of Curve Metapool coin at index 0
 * @param {*} coin1 token symbol of Curve Metapool coin at index 1
 */
const logCurvePool = async (pool, coin0, coin1, blockTag) => {
  const balances = await pool.get_balances({ blockTag });

  const totalBalances = balances[0].add(balances[1]);
  const ethBasisPoints = balances[0].mul(10000).div(totalBalances);
  const oethBasisPoints = balances[1].mul(10000).div(totalBalances);
  log(
    `${coin0} balance: ${formatUnits(balances[0])} ${formatUnits(
      ethBasisPoints,
      2
    )}%`
  );
  log(
    `${coin1} balance: ${formatUnits(balances[1])} ${formatUnits(
      oethBasisPoints,
      2
    )}%`
  );

  const virtualPrice = await pool.get_virtual_price({ blockTag });
  log(`LP virtual price: ${formatUnits(virtualPrice)} ${coin1}`);

  // swap 1 OETH for ETH (OETH/ETH)
  const price1 = await pool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1"),
    { blockTag }
  );
  log(`${coin1}/${coin0} price : ${formatUnits(price1)}`);

  // swap 1 ETH for OETH (ETH/OETH)
  const price2 = await pool["get_dy(int128,int128,uint256)"](
    0,
    1,
    parseUnits("1"),
    { blockTag }
  );
  log(`${coin0}/${coin1} price : ${formatUnits(price2)}`);

  return { balances, virtualPrice };
};

module.exports = {
  logCurvePool,
  log,
};
