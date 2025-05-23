const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const fs = require("fs");
const path = require("path");

const UNISWAP_FEE_BP = 5;
const OUR_FEE_BP = 4;

const decodeSwapLog = (rawLog) => {
  const uniPoolAbi = '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"CollectProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid1","type":"uint256"}],"name":"Flash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextOld","type":"uint16"},{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextNew","type":"uint16"}],"name":"IncreaseObservationCardinalityNext","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Initialize","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"feeProtocol0Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol0New","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1New","type":"uint8"}],"name":"SetFeeProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"int256","name":"amount0","type":"int256"},{"indexed":false,"internalType":"int256","name":"amount1","type":"int256"},{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Swap","type":"event"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collect","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collectProtocol","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fee","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal0X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal1X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"flash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"}],"name":"increaseObservationCardinalityNext","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxLiquidityPerTick","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"mint","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"observations","outputs":[{"internalType":"uint32","name":"blockTimestamp","type":"uint32"},{"internalType":"int56","name":"tickCumulative","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityCumulativeX128","type":"uint160"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32[]","name":"secondsAgos","type":"uint32[]"}],"name":"observe","outputs":[{"internalType":"int56[]","name":"tickCumulatives","type":"int56[]"},{"internalType":"uint160[]","name":"secondsPerLiquidityCumulativeX128s","type":"uint160[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"positions","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFees","outputs":[{"internalType":"uint128","name":"token0","type":"uint128"},{"internalType":"uint128","name":"token1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"feeProtocol0","type":"uint8"},{"internalType":"uint8","name":"feeProtocol1","type":"uint8"}],"name":"setFeeProtocol","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"}],"name":"snapshotCumulativesInside","outputs":[{"internalType":"int56","name":"tickCumulativeInside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityInsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsInside","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bool","name":"zeroForOne","type":"bool"},{"internalType":"int256","name":"amountSpecified","type":"int256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"int256","name":"amount0","type":"int256"},{"internalType":"int256","name":"amount1","type":"int256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int16","name":"","type":"int16"}],"name":"tickBitmap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"","type":"int24"}],"name":"ticks","outputs":[{"internalType":"uint128","name":"liquidityGross","type":"uint128"},{"internalType":"int128","name":"liquidityNet","type":"int128"},{"internalType":"uint256","name":"feeGrowthOutside0X128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthOutside1X128","type":"uint256"},{"internalType":"int56","name":"tickCumulativeOutside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityOutsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsOutside","type":"uint32"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]';
  const interface = new ethers.utils.Interface(uniPoolAbi);
  return interface.parseLog(rawLog);
};

const blockData = {
  "15 min": {
    increase: { start: 22536782, end: 22537179 },
    decrease: { start: 22532542, end: 22532739 },
    stable: { start: 22525326, end: 22525622 },
  },
  "1 hour": {
    increase: { start: 22472677, end: 22476827 },
    decrease: { start: 22510921, end: 22515086 },
    stable: { start: 22500835, end: 22507959 },
  },
  "4 hours": {
    increase: { start: 22428092, end: 22456401 },
    decrease: { start: 21740793, end: 21762265 },
    stable: { start: 21805233, end: 21883856 },
  },
  "1 Day": {
    increase: { start: 19165490, end: 19415286 },
    decrease: { start: 21905311, end: 22227625 },
    stable: { start: 20673498, end: 21053237 },
  },
};

const fetchLogs = async (fromBlock, toBlock) => {
  const cacheDir = path.join(__dirname, "cache_logs");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }
  const cacheFile = path.join(cacheDir, `logs_${fromBlock}_${toBlock}.json`);
  if (fs.existsSync(cacheFile)) {
    const cached = fs.readFileSync(cacheFile, "utf8");
    return JSON.parse(cached);
  }
  process.stdout.write("Fetching logs:");

  // maximum amount of block delta fetched in a single request
  const MAX_FETCH_BLOCK_RANGE = 4000;
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL
  );
  const uniV3usdcETH = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
  const swapTopic =
    "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

  let logs = [];
  let toBlockTemp = fromBlock;
  while (true) {
    if (fromBlock > toBlock) {
      break;
    }
    if (fromBlock + MAX_FETCH_BLOCK_RANGE < toBlock) {
      toBlockTemp = fromBlock + MAX_FETCH_BLOCK_RANGE;
    } else {
      toBlockTemp = toBlock;
    }

    process.stdout.write(".");
    //console.log("fetching logs: ", fromBlock, toBlockTemp);
    const lastLogs = await provider.getLogs({
      address: uniV3usdcETH,
      topics: [swapTopic],
      fromBlock,
      toBlock: toBlockTemp,
    });

    fromBlock = toBlockTemp + 1;

    logs = logs.concat(lastLogs);
  }

  //console.log(`Fetched ${logs.length} raw logs`);
  process.stdout.write("\r\x1b[K")
  // Save to cache
  fs.writeFileSync(cacheFile, JSON.stringify(logs));
  return logs;
};

// turn a swaplog into: {ethAmount: BigNumber, usdcAmount: BigNumber, blockNumber: Int, amountInETH: bool}
const simplifySwapLog = (rawLog, log) => {
  const UNISWAP_FEE_BP = 5;
  const returnData = {
    blockNumber: rawLog.blockNumber,
    ethAmount: log.args.amount1,
    usdcAmount: log.args.amount0,
    amountInETH: false, // modify later
  };

  if (returnData.ethAmount.gte(BigNumber.from("0"))) {
    const { amount, fee } = removeFee(returnData.ethAmount, UNISWAP_FEE_BP);
    returnData.ethAmount = amount;
    returnData.fee = fee;
    returnData.amountInETH = true;
  } else {
    const { amount, fee } = removeFee(returnData.usdcAmount, UNISWAP_FEE_BP);
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
    fee = amountBn
      .mul(BigNumber.from(`${swapFee}`))
      .div(BigNumber.from("10000"));
    amount = amountBn.add(fee);
  } else {
    fee = amountBn
      .mul(BigNumber.from(`${swapFee}`))
      .div(BigNumber.from(`${10000 + swapFee}`));
    amount = amountBn.sub(fee);
  }
  return {
    amount,
    fee,
  };
};

const fetchAndParseLogs = async (fromBlock, toBlock) => {
  const rawLogs = await fetchLogs(fromBlock, toBlock);
  const logsFull = rawLogs.map((log) => decodeSwapLog(log));

  const logs = [];
  for (let i = 0; i < rawLogs.length; i++) {
    logs.push(simplifySwapLog(rawLogs[i], logsFull[i]));
  }

  return logs;
};

// START SIMULATION PART

const runSimpleSimulation = async (
  ethLiquidityStart,
  usdcLiquidityStart,
  uniswapTradingLogs,
  description,
  blocks
) => {
  let ethLiquidity = ethLiquidityStart;
  let usdcLiquidity = usdcLiquidityStart;
  let lastEthPrice = -1;
  let usdcFeeEarned = BigNumber.from("0");
  let ethFeeEarned = BigNumber.from("0");
  let tradesExecuted = 0;

  const canTrade = (tradingLog) => {
    if (tradingLog.amountInETH) {
      return tradingLog.usdcAmount.abs().lt(usdcLiquidity) && tradingLog.usdcAmount.abs().lt(BigNumber.from("1000000000"));
    } else {
      return tradingLog.ethAmount.abs().lt(ethLiquidity) && tradingLog.ethAmount.abs().lt(BigNumber.from("500000000000000000"));
    }
  };

  const doEndStateAccounting = () => {
    // After all trades, check what are we holding
    // Target is to have as much ETH than at the beginning.
    // 1. If we have more ETH than at the beginning -> Swap Surplus ETH to USDC
    if (ethLiquidity.gt(ethLiquidityStart)) {
      const surplusEth = ethLiquidity.sub(ethLiquidityStart);
      ethLiquidity = ethLiquidity.sub(surplusEth);

      // Convert surplus ETH to USDC
      surplusUSDC = lastEthPrice.mul(surplusEth).div(BigNumber.from("1000000000000000000").mul(BigNumber.from("1000000000000"))); // div(1e18 * 1e12);
      usdcLiquidity = usdcLiquidity.add(surplusUSDC);
      //console.log("Surplus ETH converted to USDC: ", surplusEth.toString(), "->", surplusUSDC.toString());
    } else if (ethLiquidity.lt(ethLiquidityStart)) {
      // 2. If we have less ETH than at the beginning -> Swap USDC to ETH
      const deficitEth = ethLiquidityStart.sub(ethLiquidity);
      ethLiquidity = ethLiquidity.add(deficitEth);

      // Convert deficit USDC to ETH
      deficitUSDC = lastEthPrice.mul(deficitEth).div(BigNumber.from("1000000000000000000").mul(BigNumber.from("1000000000000"))); // div(1e18 * 1e12)
      usdcLiquidity = usdcLiquidity.sub(deficitUSDC);
      //console.log("Deficit USDC converted to ETH: ", deficitUSDC.toString(), "->", deficitEth.toString());
    }
  };

  const trade = (tradingLog) => {
    tradesExecuted++;

    const calculateOurFee = () => {
      const fee = tradingLog.fee
        .mul(BigNumber.from(`${OUR_FEE_BP}`))
        .div(BigNumber.from(`${UNISWAP_FEE_BP}`))

      return fee;
    };

    if (tradingLog.amountInETH) {
      ethFeeEarned = ethFeeEarned.add(calculateOurFee());
    } else {
      usdcFeeEarned = usdcFeeEarned.add(calculateOurFee());
    }

    ethLiquidity = ethLiquidity.add(tradingLog.ethAmount);
    usdcLiquidity = usdcLiquidity.add(tradingLog.usdcAmount);

    if (!tradingLog.ethAmount.isZero()) {
      // Give a result with 18 decimals
      lastEthPrice = tradingLog.usdcAmount
        .abs()
        .mul(BigNumber.from("1000000000000"))
        .mul(BigNumber.from("1000000000000000000"))
        .div(tradingLog.ethAmount.abs());
    }
  };

  uniswapTradingLogs.forEach((tradingLog) => {
    if (canTrade(tradingLog)) {
      trade(tradingLog);
    }
  });

  doEndStateAccounting();

  report({
    ethLiquidityStart,
    usdcLiquidityStart,
    ethLiquidityEnd: ethLiquidity,
    usdcLiquidityEnd: usdcLiquidity,
    lastEthPrice,
    usdcFeeEarned,
    ethFeeEarned,
    uniswapTradingLogs,
    tradesExecuted,
    description,
    blocks,
    isSimple: true
  });
}

// END SIMULATION PART

const report = ({
  isSimple,
  ethLiquidityStart,
  usdcLiquidityStart,
  ethLiquidityEnd,
  usdcLiquidityEnd,
  lastEthPrice,
  usdcFeeEarned,
  ethFeeEarned,
  uniswapTradingLogs,
  tradesExecuted,
  description,
  blocks
}) => {
  const allTrades = uniswapTradingLogs.length;
  const tradePct = tradesExecuted / allTrades * 100;
  const ethToUSDC = (ethPrice) => {
    return ethPrice
      .mul(lastEthPrice)
      .div(BigNumber.from("1000000000000000000"))
      .div(BigNumber.from("1000000000000"));
  };
  const ethEarnedInUSDC = ethToUSDC(ethFeeEarned);
  const totalFeesEarnedInUSDC = parseFloat(ethEarnedInUSDC.add(usdcFeeEarned)) / 1e6;

  const usdcLiquidityEndFloat = parseFloat(usdcLiquidityEnd.toString()) / 1e6;

  const profitLoss = usdcLiquidityEndFloat + totalFeesEarnedInUSDC - parseFloat(usdcLiquidityStart) / 1e6;
  const initialCapitalInUSDC = parseFloat(usdcLiquidityStart.add(ethToUSDC(ethLiquidityStart))) / 1e6;

  const calculateEarnings = () => {
    const SECONDS_IN_A_YEAR = 31556926;
    const SECONDS_IN_A_DAY = 86400;
    const AVERAGE_BLOCK_TIME = 12.1;

    const timeElapsed = AVERAGE_BLOCK_TIME * blocks;
    const yearlyProfitLoss = profitLoss * SECONDS_IN_A_YEAR / timeElapsed;
    const apy = (yearlyProfitLoss / initialCapitalInUSDC);
    const durationInDays = timeElapsed / SECONDS_IN_A_DAY;

    return {
      yearlyProfitLoss,
      apy,
      durationInDays
    };
  }

  const { yearlyProfitLoss, apy, durationInDays } = calculateEarnings();

  if (isSimple) {
    console.log(`[${durationInDays.toFixed(2)} days | ${description} trades stolen: ${tradePct}%]\t profit/loss:\t${profitLoss.toFixed(2)} USDC apy: ${(apy * 100).toFixed(2)}%`);
    return
  }

  console.log("ethFeeEarned", ethFeeEarned);

  console.log(`---------- ${description} REPORT -----------`)
  console.log("Uniswap trades: \t\t", allTrades);
  console.log("Trades intercepted: \t\t", tradesExecuted);

  console.log("ethLiquidityStart", ethLiquidityStart.toString());
  console.log("ethLiquidityEnd", ethLiquidityEnd.toString());

  console.log("usdcLiquidityStart", usdcLiquidityStart.toString());
  console.log("usdcLiquidityEnd", usdcLiquidityEnd.toString());

  console.log("usdcFeeEarned", usdcFeeEarned.toString());
  console.log("ethFeeEarned", ethFeeEarned.toString());
  console.log(
    "lastEthPrice",
    (parseFloat(lastEthPrice) / 1e18).toFixed(4),
    "USDC"
  );
  console.log("---------------------------------------------")

  console.log("totalFeesEarnedInUSDC", totalFeesEarnedInUSDC);
  console.log("usdcLiquidityEnd", usdcLiquidityEndFloat.toFixed(2));

  console.log("Profit/loss", profitLoss.toFixed(2));

};

async function main() {
  const ethUnits = 10;
  const usdcUnits = 25000;
  const ethLiquidity = ethers.utils.parseUnits(`${ethUnits}`, 18);
  const usdcLiquidity = ethers.utils.parseUnits(`${usdcUnits}`, 6);

  for (const tp of Object.keys(blockData)) {
    const timePeriod = blockData[tp];
    for (const marketStyle of Object.keys(timePeriod)) {
      const { start, end } = timePeriod[marketStyle];

      const logs = await fetchAndParseLogs(start, end);
      await runSimpleSimulation(
        ethLiquidity,
        usdcLiquidity,
        logs, `fee ${OUR_FEE_BP}bp | ${marketStyle} pool liq: ${ethUnits} ETH ${usdcUnits} USDC`,
        end - start
      );
    }
  }

  // const fromBlock = 22536782;
  // const toBlock = 22536792;

  // const logs = await fetchAndParseLogs(fromBlock, toBlock);
  // await runSimpleSimulation(ethLiquidity, usdcLiquidity, logs, "small time", toBlock - fromBlock);
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
