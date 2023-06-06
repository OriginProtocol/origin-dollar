const { formatUnits, parseUnits } = require("ethers/lib/utils");

const log = require("./logger")("utils:curve");

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

  log(`virtual price: ${formatUnits(await pool.get_virtual_price())}`);

  // price 1 OETH to ETH
  const price = await pool["get_dy(int128,int128,uint256)"](
    1,
    0,
    parseUnits("1")
  );
  log(`${coin1}/${coin0} price: ${formatUnits(price)}`);
};

module.exports = {
  logCurvePool,
};
