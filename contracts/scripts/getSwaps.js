const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const decodeSwapLog = (rawLog) => {
  const uniPoolAbi = '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"CollectProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid1","type":"uint256"}],"name":"Flash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextOld","type":"uint16"},{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextNew","type":"uint16"}],"name":"IncreaseObservationCardinalityNext","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Initialize","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"feeProtocol0Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol0New","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1New","type":"uint8"}],"name":"SetFeeProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"int256","name":"amount0","type":"int256"},{"indexed":false,"internalType":"int256","name":"amount1","type":"int256"},{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Swap","type":"event"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collect","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collectProtocol","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fee","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal0X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal1X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"flash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"}],"name":"increaseObservationCardinalityNext","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxLiquidityPerTick","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"mint","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"observations","outputs":[{"internalType":"uint32","name":"blockTimestamp","type":"uint32"},{"internalType":"int56","name":"tickCumulative","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityCumulativeX128","type":"uint160"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32[]","name":"secondsAgos","type":"uint32[]"}],"name":"observe","outputs":[{"internalType":"int56[]","name":"tickCumulatives","type":"int56[]"},{"internalType":"uint160[]","name":"secondsPerLiquidityCumulativeX128s","type":"uint160[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"positions","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFees","outputs":[{"internalType":"uint128","name":"token0","type":"uint128"},{"internalType":"uint128","name":"token1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"feeProtocol0","type":"uint8"},{"internalType":"uint8","name":"feeProtocol1","type":"uint8"}],"name":"setFeeProtocol","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"}],"name":"snapshotCumulativesInside","outputs":[{"internalType":"int56","name":"tickCumulativeInside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityInsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsInside","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bool","name":"zeroForOne","type":"bool"},{"internalType":"int256","name":"amountSpecified","type":"int256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"int256","name":"amount0","type":"int256"},{"internalType":"int256","name":"amount1","type":"int256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int16","name":"","type":"int16"}],"name":"tickBitmap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"","type":"int24"}],"name":"ticks","outputs":[{"internalType":"uint128","name":"liquidityGross","type":"uint128"},{"internalType":"int128","name":"liquidityNet","type":"int128"},{"internalType":"uint256","name":"feeGrowthOutside0X128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthOutside1X128","type":"uint256"},{"internalType":"int56","name":"tickCumulativeOutside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityOutsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsOutside","type":"uint32"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
  const interface = new ethers.utils.Interface(uniPoolAbi);
  return interface.parseLog(rawLog);
};

const blockData = {
  "1 Day": {
    increase: { start: 19165490, end: 19415286 },
    decrease: { start: 21905311, end: 22227625 },
    stable:   { start: 20673498, end: 21053237 },
  },
  "4 hours": {
    increase: { start: 22428092, end: 22456401 },
    decrease: { start: 21740793, end: 21762265 },
    stable:   { start: 21805233, end: 21883856 },
  },
  "1 hour": {
    increase: { start: 22472677, end: 22476827 },
    decrease: { start: 22510921, end: 22515086 },
    stable:   { start: 22500835, end: 22507959 },
  },
  "15 min": {
    increase: { start: 22536782, end: 22537179 },
    decrease: { start: 22532542, end: 22532739 },
    stable:   { start: 22525326, end: 22525622 },
  }
};

const fetchLogs = async (fromBlock, toBlock) => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
  const uniV3usdcETH = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
  const swapTopic = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

  const logs = await provider.getLogs({
    address: uniV3usdcETH,
    topics: [swapTopic],
    fromBlock, 
    toBlock
  });

  console.log(`Fetched ${logs.length} raw logs`);
  return logs;
};

// turn a swaplog into: {ethAmount: BigNumber, usdcAmount: BigNumber, blockNumber: Int, amountInETH: bool}
const simplifySwapLog = (rawLog, log) => {
  const swapFeeBp = 5;
  const returnData = {
    blockNumber: rawLog.blockNumber,
    ethAmount: log.args.amount0,
    usdcAmount: log.args.amount1,
    amountInETH: false // modify later
  };

  if (returnData.ethAmount.gte(BigNumber.from("0"))) {
    const {amount, fee} = removeFee(returnData.ethAmount, swapFeeBp);
    returnData.ethAmount = amount;
    returnData.fee = fee;
    returnData.amountInETH = true;
  } else {
    const {amount, fee} = removeFee(returnData.usdcAmount, swapFeeBp);
    returnData.usdcAmount = amount;
    returnData.fee = fee;
    returnData.amountInETH = false;
  }

  return returnData;
};

const addFee = (amountBn, swapFee) => {
  return handleFee(amountBn, swapFee, true);
};

const removeFee = (amountBn, swapFee) => {
  return handleFee(amountBn, swapFee, false);
};

const handleFee = (amountBn, swapFee, add = true) => {
  let fee, amount;
  if (add) {
    fee = amountBn.mul(BigNumber.from(`${swapFee}`)).div(BigNumber.from("10000"));
    amount = amountBn.add(fee);
  } else {
    fee = amountBn.mul(BigNumber.from(`${swapFee}`)).div(BigNumber.from(`${10000 + swapFee}`));
    amount = amountBn.sub(fee);
  }
  return {
    amount,
    fee
  };
};

const fetchAndParseLogs = async (fromBlock, toBlock) => {
  const rawLogs = await fetchLogs(fromBlock, toBlock);
  const logsFull = rawLogs.map(log => decodeSwapLog(log));
  const logs = []
  for(let i = 0; i < rawLogs.length; i++) {
    logs.push(simplifySwapLog(rawLogs[i], logsFull[i]));
  }

  return logs;
};

// START SIMULATION PART

const runSimpleSimulation = async (ethLiquidityStart, usdcLiquidityStart, uniswapTradingLogs) => {
  let ethLiquidity = ethLiquidityStart;
  let usdcLiquidity = usdcLiquidityStart;
  let lastEthPrice = -1;
  let feesEarned = BigNumber.from("0");
  let tradesExecuted = 0;

  const canTrade = (tradingLog) => {
    if (tradingLog.amountInETH) {
      return tradingLog.usdcAmount.abs().lt(usdcLiquidity);
    } else {
      return tradingLog.ethAmount.abs().lt(ethLiquidity);
    }
  };

  const trade = (tradingLog) => {
    tradesExecuted ++;

    console.log("tradingLog.fee", tradingLog.fee);
    feesEarned = feesEarned.add(tradingLog.fee);
    ethLiquidity = ethLiquidity.add(tradingLog.ethAmount);
    usdcLiquidity = usdcLiquidity.add(tradingLog.usdcAmount);

    lastEthPrice; // calculate eth price
  };

  uniswapTradingLogs.forEach(tradingLog => {
    if (canTrade(tradingLog)) {
      trade(tradingLog);
    }
  });

  report(ethLiquidityStart, usdcLiquidityStart, ethLiquidity, usdcLiquidity, lastEthPrice, feesEarned, uniswapTradingLogs, tradesExecuted);
}

// END SIMULATION PART


const report = (ethLiquidityStart, usdcLiquidityStart, ethLiquidityEnd, usdcLiquidityEnd, lastEthPrice, feesEarned, uniswapTradingLogs, tradesExecuted) => {
  console.log("---------- REPORT -----------")
  console.log("Uniswap trades: \t\t", uniswapTradingLogs.length);
  console.log("Trades intercepted: \t\t", tradesExecuted);




  console.log("ethLiquidityStart", ethLiquidityStart.toString());
  console.log("ethLiquidityEnd", ethLiquidityEnd.toString());
  console.log("feesEarned", feesEarned.toString());
  console.log("lastEthPrice", lastEthPrice.toString());
};

async function main() {
  // stable 1 hour
  //const toBlock = 22507959;
  const toBlock = 22500845;
  const fromBlock = 22500835;
  const ethLiquidity = ethers.utils.parseUnits("100", 18);
  const usdcLiquidity = ethers.utils.parseUnits("250000", 6);

  const logs = await fetchAndParseLogs(fromBlock, toBlock);
  await runSimpleSimulation(ethLiquidity, usdcLiquidity, logs);
}




// Run the job.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}