const ccxt = require("ccxt");

const hyperliquid = new ccxt.hyperliquid({
  apiKey: process.env.HYPERLIQUID_API_KEY,
  secret: process.env.HYPERLIQUID_SECRET,
});

async function fetchMarkets() {
  const markets = await hyperliquid.fetchMarkets();
  console.log(markets);
}

async function fetchMarket(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);
  console.log(market);
  console.log(market.future);
}

async function createOrder(taskArgs) {
  await hyperliquid.loadMarkets();
  //   const market = await hyperliquid.market(taskArgs.market);

  // Set leverage if specified
  if (taskArgs.leverage) {
    await hyperliquid.setLeverage(taskArgs.leverage, taskArgs.market);
  }

  const order = await hyperliquid.createOrder(
    taskArgs.market,
    taskArgs.type,
    taskArgs.side,
    taskArgs.amount,
    taskArgs.price
  );
  console.log(order);
}

async function fetchFundingRates(taskArgs) {
  const fundingRates = await hyperliquid.fetchFundingRates(
    taskArgs.markets.split(",")
  );
  console.log(fundingRates);
}

async function fetchPerpetualDetails(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);
  console;
  // Get funding rate info
  const fundingRates = await hyperliquid.fetchFundingRates([taskArgs.market]);
  const fundingInfo = fundingRates[taskArgs.market];

  console.log("Perpetual Swap Details:");
  console.log("----------------------");
  console.log(`Market: ${market.symbol}`);
  console.log(`Mark Price: ${fundingInfo.markPrice}`);
  console.log(`Index Price: ${fundingInfo.indexPrice}`);
  console.log(
    `Premium: ${(parseFloat(market.info.premium) * 100).toFixed(4)}%`
  );
  console.log(`Funding Rate: ${(fundingInfo.fundingRate * 100).toFixed(4)}%`);
  console.log(`Next Funding: ${fundingInfo.fundingDatetime}`);
  console.log(`Max Leverage: ${market.limits.leverage.max}x`);
  console.log(`Open Interest: ${market.info.openInterest}`);
}

async function createTWAPOrder(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);

  // Set leverage if specified
  if (taskArgs.leverage) {
    await hyperliquid.setLeverage(taskArgs.leverage, taskArgs.market);
  }

  // Create the request payload
  const payload = {
    action: {
      type: "twapOrder",
      twap: {
        a: market.id, // asset number
        b: taskArgs.side === "buy", // isBuy boolean
        s: taskArgs.amount.toString(), // size as string
        r: false, // reduceOnly
        m: parseInt(taskArgs.interval) || 5, // minutes
        t: false, // randomize
      },
    },
    nonce: Date.now(),
  };

  // Create the signature
  const signature = await hyperliquid.sign(
    JSON.stringify(payload),
    hyperliquid.secret
  );

  // Add the signature to the payload
  payload.signature = signature;

  // Make the API call
  const response = await hyperliquid.privatePostExchange(payload);
  console.log("TWAP Order Created:", response);
  return response;
}

async function createPerpetualPosition(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);

  // Validate it's a perpetual market
  if (!market.swap) {
    throw new Error(`${taskArgs.market} is not a perpetual swap market`);
  }

  // Set leverage if specified
  if (taskArgs.leverage) {
    const leverage = parseInt(taskArgs.leverage);
    if (leverage > market.limits.leverage.max) {
      throw new Error(
        `Leverage ${leverage}x exceeds maximum allowed ${market.limits.leverage.max}x`
      );
    }
    await hyperliquid.setLeverage(leverage, taskArgs.market);
  }

  // Get current market prices
  const ticker = await hyperliquid.fetchTicker(taskArgs.market);
  const markPrice = ticker.last || ticker.mark;

  // Calculate position size based on leverage
  const positionSize = parseFloat(taskArgs.amount);
  const marginRequired = (positionSize * markPrice) / (taskArgs.leverage || 1);

  console.log("Creating Perpetual Position:");
  console.log("---------------------------");
  console.log(`Market: ${market.symbol}`);
  console.log(`Side: ${taskArgs.side}`);
  console.log(`Position Size: ${positionSize} ${market.base}`);
  console.log(`Mark Price: $${markPrice}`);
  console.log(`Leverage: ${taskArgs.leverage || 1}x`);
  console.log(`Margin Required: $${marginRequired}`);
  console.log(`Funding Rate: ${(market.info.funding * 100).toFixed(4)}%`);

  // Create the order
  const order = await hyperliquid.createOrder(
    taskArgs.market,
    taskArgs.type,
    taskArgs.side,
    positionSize,
    taskArgs.price || undefined
  );

  console.log("\nOrder Created:");
  console.log(order);

  return order;
}

async function createAveragedPosition(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);

  // Validate it's a perpetual market
  if (!market.swap) {
    throw new Error(`${taskArgs.market} is not a perpetual swap market`);
  }

  // Set leverage if specified
  if (taskArgs.leverage) {
    const leverage = parseInt(taskArgs.leverage);
    if (leverage > market.limits.leverage.max) {
      throw new Error(
        `Leverage ${leverage}x exceeds maximum allowed ${market.limits.leverage.max}x`
      );
    }
    await hyperliquid.setLeverage(leverage, taskArgs.market);
  }

  // Parse price levels and weights
  const priceLevels = taskArgs.prices.split(",").map(Number);
  const weights = taskArgs.weights
    ? taskArgs.weights.split(",").map(Number)
    : Array(priceLevels.length).fill(1 / priceLevels.length);

  if (priceLevels.length !== weights.length) {
    throw new Error("Number of price levels must match number of weights");
  }

  // Normalize weights to sum to 1
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Calculate position sizes for each level
  const totalPositionSize = parseFloat(taskArgs.amount);
  const positionSizes = normalizedWeights.map((w) => totalPositionSize * w);

  console.log("Creating Averaged Position:");
  console.log("---------------------------");
  console.log(`Market: ${market.symbol}`);
  console.log(`Side: ${taskArgs.side}`);
  console.log(`Total Position Size: ${totalPositionSize} ${market.base}`);
  console.log(`Leverage: ${taskArgs.leverage || 1}x`);

  // Calculate weighted average price
  const avgPrice = priceLevels.reduce(
    (sum, price, i) => sum + price * normalizedWeights[i],
    0
  );
  console.log(`Average Entry Price: $${avgPrice.toFixed(2)}`);

  // Execute orders at each price level
  const orders = [];
  for (let i = 0; i < priceLevels.length; i++) {
    console.log(`\nExecuting order ${i + 1}/${priceLevels.length}:`);
    console.log(`Price: $${priceLevels[i]}`);
    console.log(`Size: ${positionSizes[i]} ${market.base}`);

    const order = await hyperliquid.createOrder(
      taskArgs.market,
      "limit",
      taskArgs.side,
      positionSizes[i],
      priceLevels[i]
    );
    orders.push(order);
    console.log("Order created:", order);
  }

  return {
    averagePrice: avgPrice,
    totalSize: totalPositionSize,
    orders: orders,
  };
}

async function monitorPriceDeviations(taskArgs) {
  await hyperliquid.loadMarkets();
  const market = await hyperliquid.market(taskArgs.market);

  // Get current market prices
  const ticker = await hyperliquid.fetchTicker(taskArgs.market);
  const markPrice = ticker.last || ticker.mark;

  // Get funding rate info
  const fundingRates = await hyperliquid.fetchFundingRates([taskArgs.market]);
  const fundingInfo = fundingRates[taskArgs.market];

  // Calculate premium/discount
  const indexPrice = fundingInfo.indexPrice;
  const premium = ((markPrice - indexPrice) / indexPrice) * 100;

  console.log("Price Deviation Analysis:");
  console.log("------------------------");
  console.log(`Market: ${market.symbol}`);
  console.log(`Mark Price: $${markPrice}`);
  console.log(`Index Price: $${indexPrice}`);
  console.log(`Premium/Discount: ${premium.toFixed(4)}%`);
  console.log(`Funding Rate: ${(fundingInfo.fundingRate * 100).toFixed(4)}%`);
  console.log(`Next Funding: ${fundingInfo.fundingDatetime}`);

  // Calculate annualized funding cost
  const annualizedFunding = fundingInfo.fundingRate * 365 * 100;
  console.log(`Annualized Funding Cost: ${annualizedFunding.toFixed(2)}%`);

  // Check if deviation is significant
  const significantDeviation = Math.abs(premium) > 1; // 1% threshold
  if (significantDeviation) {
    console.log("\n⚠️ Significant price deviation detected!");
    console.log("This may indicate:");
    console.log("- High market volatility");
    console.log("- Low liquidity");
    console.log("- Potential arbitrage opportunities");
  }

  return {
    markPrice,
    indexPrice,
    premium,
    fundingRate: fundingInfo.fundingRate,
    annualizedFunding,
    significantDeviation,
  };
}

module.exports = {
  fetchMarkets,
  fetchMarket,
  createOrder,
  fetchFundingRates,
  fetchPerpetualDetails,
  createTWAPOrder,
  createPerpetualPosition,
  createAveragedPosition,
  monitorPriceDeviations,
};
