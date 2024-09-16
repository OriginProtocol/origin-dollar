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

  const { tick, sqrtPriceX96 } = await pool.connect(signer).slot0({ blockTag });
  const Q96 = BigNumber.from(2).pow(96);
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
  const { _amountWeth: tickWethBalance, _amountOethb: tickOethBalance } =
    await aeroStrat.getPositionPrincipal();
  const tickTotal = tickWethBalance.add(tickOethBalance);
  const tickWethPercentage = tickWethBalance.mul(10000).div(tickTotal);
  const tickOethPercentage = tickOethBalance.mul(10000).div(tickTotal);
  const tickTotalPercentage = tickTotal.mul(10000).div(poolTotal);

  const checkBalance = await aeroStrat
    .connect(signer)
    .checkBalance(weth.address, { blockTag });

  const vaultWethBalance = await weth
    .connect(signer)
    .balanceOf(vault.address, { blockTag });

  console.log(
    `Pool price       : ${formatUnits(poolPrice, 10)} OETHb/WETH, ${tick} tick`
  );
  console.log(
    `Pool WETH        : ${formatUnits(poolWethBalance)} (${formatUnits(
      poolWethPercentage,
      2
    )}%), ${poolWethBalance} wei`
  );
  console.log(
    `Pool OETH        : ${formatUnits(poolOethBalance)} (${formatUnits(
      poolOethPercentage,
      2
    )}%), ${poolOethBalance} wei`
  );
  console.log(`Pool total       : ${formatUnits(poolTotal)}`);
  console.log(
    `Tick strat WETH  : ${formatUnits(tickWethBalance)} (${formatUnits(
      tickWethPercentage,
      2
    )}%), ${poolWethBalance} wei`
  );
  console.log(
    `Tick strat OETH  : ${formatUnits(tickOethBalance)} (${formatUnits(
      tickOethPercentage,
      2
    )}%), ${poolOethBalance} wei`
  );
  console.log(
    `Tick strat total : ${formatUnits(tickTotal)} ${formatUnits(
      tickTotalPercentage,
      2
    )}% of pool`
  );
  console.log(
    `Strategy balance : ${formatUnits(checkBalance)} ether, ${checkBalance} wei`
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
