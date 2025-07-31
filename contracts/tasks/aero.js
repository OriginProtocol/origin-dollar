const { formatUnits } = require("ethers").utils;
const { BigNumber } = require("ethers");
const { getBlock } = require("./block");
const { resolveAsset, resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { base } = require("../utils/addresses");

const snapAero = async ({ block }) => {
  const signer = await getSigner();
  const blockTag = await getBlock(block);

  const weth = await resolveAsset("WETH");
  const vault = await resolveContract("OETHBaseVaultProxy", "IVault");
  const oeth = await resolveContract("OETHBaseProxy", "OETHBase");
  const pool = await resolveContract(base.aerodromeOETHbWETHClPool, "ICLPool");
  const aeroStrat = await resolveContract(
    `AerodromeAMOStrategyProxy`,
    "AerodromeAMOStrategy"
  );
  const sugarHelper = await resolveContract(base.sugarHelper, "ISugarHelper");

  const Q96 = BigNumber.from(2).pow(96);
  const sqrtRatioX96TickLower = await aeroStrat
    .connect(signer)
    .sqrtRatioX96TickLower({ blockTag });
  const sqrtRatioX96TickHigher = await aeroStrat
    .connect(signer)
    .sqrtRatioX96TickHigher({ blockTag });
  const lowerTick = await aeroStrat.connect(signer).lowerTick({ blockTag });

  const { tick, sqrtPriceX96 } = await pool.connect(signer).slot0({ blockTag });
  const { liquidityGross } = await pool
    .connect(signer)
    .ticks(lowerTick, { blockTag });
  const { amount0: tickWethBalance, amount1: tickOethBalance } =
    await sugarHelper
      .connect(signer)
      .getAmountsForLiquidity(
        sqrtPriceX96,
        sqrtRatioX96TickLower,
        sqrtRatioX96TickHigher,
        liquidityGross,
        { blockTag }
      );

  // Pool balances
  const poolPrice = sqrtPriceX96
    .mul(sqrtPriceX96)
    .mul(10000000000)
    .div(Q96)
    .div(Q96);
  const poolWethBalance = await weth
    .connect(signer)
    .balanceOf(base.aerodromeOETHbWETHClPool, { blockTag });
  const poolOethBalance = await oeth
    .connect(signer)
    .balanceOf(base.aerodromeOETHbWETHClPool, { blockTag });
  const poolTotal = poolWethBalance.add(poolOethBalance);
  const poolWethPercentage = poolWethBalance.mul(10000).div(poolTotal);
  const poolOethPercentage = poolOethBalance.mul(10000).div(poolTotal);

  // Tick balances
  const tickTotal = tickWethBalance.add(tickOethBalance);
  const tickWethPercentage = tickWethBalance.mul(10000).div(tickTotal);
  const tickOethPercentage = tickOethBalance.mul(10000).div(tickTotal);
  const tickTotalPercentage = tickTotal.mul(10000).div(poolTotal);

  // Strategy's tick position
  const {
    _amountWeth: tickStratWethBalance,
    _amountOethb: tickStratOethBalance,
  } = await aeroStrat.getPositionPrincipal();
  const tickStratTotal = tickStratWethBalance.add(tickStratOethBalance);
  const tickStratWethPercentage = tickStratWethBalance
    .mul(10000)
    .div(tickStratTotal);
  const tickStratOethPercentage = tickStratOethBalance
    .mul(10000)
    .div(tickStratTotal);
  const tickStratTotalOfTickPercentage = tickStratTotal
    .mul(10000)
    .div(tickTotal);
  const tickStratTotalOfPoolPercentage = tickStratTotal
    .mul(10000)
    .div(poolTotal);

  const checkBalance = await aeroStrat
    .connect(signer)
    .checkBalance(weth.address, { blockTag });

  const vaultWethBalance = await weth
    .connect(signer)
    .balanceOf(vault.address, { blockTag });

  // Pool balances
  console.log(
    `Pool price       : ${formatUnits(poolPrice, 10)} OETHb/WETH, ${tick} tick`
  );
  console.log(
    `Pool WETH        : ${formatUnits(poolWethBalance)} (${formatUnits(
      poolWethPercentage,
      2
    )}%), ${poolWethBalance} wei (includes unclaimed WETH)`
  );
  console.log(
    `Pool OETH        : ${formatUnits(poolOethBalance)} (${formatUnits(
      poolOethPercentage,
      2
    )}%), ${poolOethBalance} wei`
  );
  console.log(`Pool total       : ${formatUnits(poolTotal)}`);

  // Tick balances
  console.log(
    `\nTick WETH        : ${formatUnits(tickWethBalance)} (${formatUnits(
      tickWethPercentage,
      2
    )}%), ${tickWethBalance} wei`
  );
  console.log(
    `Tick OETH        : ${formatUnits(tickOethBalance)} (${formatUnits(
      tickOethPercentage,
      2
    )}%), ${tickOethBalance} wei`
  );
  console.log(
    `Tick total       : ${formatUnits(tickStratTotal)} ${formatUnits(
      tickTotalPercentage,
      2
    )}% of pool`
  );

  // Strategy's tick position
  console.log(
    `\nTick strat WETH  : ${formatUnits(tickStratWethBalance)} (${formatUnits(
      tickStratWethPercentage,
      2
    )}%), ${poolWethBalance} wei`
  );
  console.log(
    `Tick strat OETH  : ${formatUnits(tickStratOethBalance)} (${formatUnits(
      tickStratOethPercentage,
      2
    )}%), ${poolOethBalance} wei`
  );
  console.log(
    `Tick strat total : ${formatUnits(tickStratTotal)} ${formatUnits(
      tickStratTotalOfTickPercentage,
      2
    )}% of tick, ${formatUnits(tickStratTotalOfPoolPercentage, 2)}% of pool`
  );

  console.log(
    `\nStrategy balance : ${formatUnits(
      checkBalance
    )} ether, ${checkBalance} wei`
  );
  console.log(
    `Vault WETH       : ${formatUnits(
      vaultWethBalance
    )}, ${vaultWethBalance} wei`
  );
};

module.exports = {
  snapAero,
};
