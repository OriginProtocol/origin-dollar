const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { isGanacheFork, loadFixture } = require("./helpers");

const { parseUnits } = require("ethers").utils;


// Note: we set decimals to match what the Mainnet feeds use.
const feedDecimals = {
  ETH: 8,
  DAI: 18,
  USDC: 18,
  USDT: 18
}

// The oracle returns prices in ETH with 6 digits, but 8 digits for tokens.
const oracleDecimals = {
  ETH_USD: 6,
  DAI_ETH: 8,
  DAI_USD: 8,
  USDC_ETH: 8,
  USDC_USD: 8,
  USDT_ETH: 8,
  USDT_USD: 8,
}

const feedPrices = {
  // Price of 1 ETH = $370
  ETH_USD: parseUnits("370", feedDecimals.ETH),
  // 1 DAI = 1/370 ETH = 0.002702 ETH = ~$0.999740
  DAI_ETH: parseUnits("0.002702", feedDecimals.DAI),
  // 1 USDC = 1/250 ETH = 0.004 ETH = $1.48
  USDC_ETH: parseUnits("0.004", feedDecimals.USDC),
  // 1 USDT = 1/360 ETH = 0.002777 ETH = ~$1.027490
  USDT_ETH: parseUnits("0.002777", feedDecimals.USDT),
}

const oraclePrices = {
  ETH_USD: parseUnits("370", oracleDecimals.ETH_USD),
  DAI_ETH: parseUnits("0.002702", oracleDecimals.DAI_ETH),
  DAI_USD: parseUnits("0.999740", oracleDecimals.DAI_USD),
  USDC_ETH: parseUnits("0.004", oracleDecimals.USDC_ETH),
  USDC_USD: parseUnits("1.48", oracleDecimals.USDC_USD),
  USDT_ETH: parseUnits("0.002777", oracleDecimals.USDT_ETH),
  USDT_USD: parseUnits("1.027490", oracleDecimals.USDT_USD),
}

describe("Oracle", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  async function initFeeds() {
    const {
      chainlinkOracleFeedETH,
      chainlinkOracleFeedDAI,
      chainlinkOracleFeedUSDC,
      chainlinkOracleFeedUSDT,
    } = await loadFixture(defaultFixture);

    await chainlinkOracleFeedETH.setPrice(feedPrices.ETH_USD);
    await chainlinkOracleFeedETH.setDecimals(feedDecimals.ETH);

    await chainlinkOracleFeedDAI.setPrice(feedPrices.DAI_ETH);
    await chainlinkOracleFeedDAI.setDecimals(feedDecimals.DAI);

    await chainlinkOracleFeedUSDC.setPrice(feedPrices.USDC_ETH);
    await chainlinkOracleFeedUSDC.setDecimals(feedDecimals.USDC);

    await chainlinkOracleFeedUSDT.setPrice(feedPrices.USDT_ETH);
    await chainlinkOracleFeedUSDT.setDecimals(feedDecimals.USDT);
  }

  it("Chainlink oracle", async () => {
    const fixtures = await loadFixture(defaultFixture);
    const { chainlinkOracle } = fixtures;
    await initFeeds();

    expect(await chainlinkOracle.ethUsdPrice()).to.eq(oraclePrices.ETH_USD);
    expect(await chainlinkOracle.tokEthPrice("DAI")).to.eq(oraclePrices.DAI_ETH);
    expect(await chainlinkOracle.tokEthPrice("USDC")).to.eq(oraclePrices.USDC_ETH);
    expect(await chainlinkOracle.tokEthPrice("USDT")).to.eq(oraclePrices.USDT_ETH);
  });

  it("Mix oracle", async () => {
    const { mixOracle } = await loadFixture(defaultFixture);
    await initFeeds()

    // Test USD prices.
    let min = await mixOracle.priceMin("DAI");
    let max = await mixOracle.priceMax("DAI");
    expect(min).to.eq(oraclePrices.DAI_USD);
    expect(max).to.eq(oraclePrices.DAI_USD);

    min = await mixOracle.priceMin("USDT");
    max = await mixOracle.priceMax("USDT");
    expect(min).to.eq(oraclePrices.USDT_USD);
    expect(max).to.eq(oraclePrices.USDT_USD);

    min = await mixOracle.priceMin("USDC");
    max = await mixOracle.priceMax("USDC");
    expect(min).to.eq(oraclePrices.USDC_USD);
    expect(max).to.eq(oraclePrices.USDC_USD);
  });

});
