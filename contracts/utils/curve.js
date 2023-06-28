const { formatUnits, parseUnits } = require("ethers/lib/utils");

const logModule = "utils:curve";
const log = require("./logger")(logModule);

/**
 *
 * @param {*} pool Curve pool contract
 * @param {*} coin0 token symbol of Curve Metapool coin at index 0
 * @param {*} coin1 token symbol of Curve Metapool coin at index 1
 */
const logCurvePool = async (pool, coin0, coin1) => {
  const balances = await pool.get_balances();

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

  log(
    `LP virtual price: ${formatUnits(await pool.get_virtual_price())} ${coin1}`
  );

  const buyPrice = await pool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1")
  );
  log(`${coin0} buy price : ${formatUnits(buyPrice)} ${coin1}`);

  const sellPrice = await pool["get_dy(int128,int128,uint256)"](
    0,
    1,
    parseUnits("1")
  );
  log(`${coin0} sell price : ${formatUnits(sellPrice)} ${coin1}`);
};

module.exports = {
  logCurvePool,
  log,
};
