const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { isGanacheFork, oracleUnits, loadFixture } = require("./helpers");

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
  ETH: 6,
  DAI: 8,
  USDC: 8,
  USDT: 8
}

const feedPrices = {
  // Price of 1 ETH = $370
  ETH_USD: parseUnits("370", feedDecimals.ETH),
  // 1 DAI = 1/370 ETH = 0.002702 ETH = ~$0.999740
  DAI_ETH: parseUnits("0.002702", feedDecimals.DAI),
  // 1 USDT = 1/360 ETH = 0.002777 ETH = ~$1.027490
  USDT_ETH: parseUnits("0.002777", feedDecimals.USDT),
  // 1 USDC = 1/250 ETH = 0.004 ETH = $1.48
  USDC_ETH: parseUnits("0.004", feedDecimals.USDC),
}

const oraclePrices = {
  ETH_USD: parseUnits("370", oracleDecimals.ETH),
  DAI_ETH: parseUnits("0.002702", oracleDecimals.DAI),
  DAI_USD: parseUnits("0.999740", oracleDecimals.DAI),
  USDT_ETH: parseUnits("0.002777", oracleDecimals.USDT),
  USDT_USD: parseUnits("1.027490", oracleDecimals.USDT),
  USDC_ETH: parseUnits("0.004", oracleDecimals.USDC),
  USDC_USD: parseUnits("1.48", oracleDecimals.USDC),
}

describe("Oracle", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  async function initFeeds() {
    const {
      chainlinkOracleFeedETH,
      chainlinkOracleFeedDAI,
      chainlinkOracleFeedUSDT,
      chainlinkOracleFeedUSDC
    } = await loadFixture(defaultFixture);

    await chainlinkOracleFeedETH.setPrice(feedPrices.ETH_USD)
    await chainlinkOracleFeedETH.setDecimals(feedDecimals.ETH)

    await chainlinkOracleFeedDAI.setPrice(feedPrices.DAI_ETH)
    await chainlinkOracleFeedDAI.setDecimals(feedDecimals.DAI)

    await chainlinkOracleFeedUSDT.setPrice(feedPrices.USDT_ETH)
    await chainlinkOracleFeedUSDT.setDecimals(feedDecimals.USDT)

    await chainlinkOracleFeedUSDC.setPrice(feedPrices.USDC_ETH)
    await chainlinkOracleFeedUSDC.setDecimals(feedDecimals.USDC)
  }

  it("Should allow multiple prices to be set and read", async () => {
    const { oracle } = await loadFixture(defaultFixture);
    await oracle.setPrice("DAI", oracleUnits("1.02"));
    await oracle.setPrice("USDT", oracleUnits("0.96"));
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
    expect(await oracle.price("USDT")).to.eq(oracleUnits("0.96"));
  });

  it("Chainlink oracle", async () => {
    const fixtures = await loadFixture(defaultFixture);
    const { chainlinkOracle } = fixtures;
    await initFeeds();

    expect(await chainlinkOracle.ethUsdPrice()).to.eq(oraclePrices.ETH_USD);
    expect(await chainlinkOracle.tokEthPrice("DAI")).to.eq(oraclePrices.DAI_ETH);
    expect(await chainlinkOracle.tokEthPrice("USDT")).to.eq(oraclePrices.USDT_ETH);
    expect(await chainlinkOracle.tokEthPrice("USDC")).to.eq(oraclePrices.USDC_ETH);
  });

  it("Mix oracle", async () => {
    const { mixOracle } = await loadFixture(defaultFixture);
    await initFeeds()

    let [min, max] = await mixOracle.priceEthMinMax();
    expect(min).to.eq(oraclePrices.ETH_USD);
    expect(max).to.eq(oraclePrices.ETH_USD);

    [min, max] = await mixOracle.priceTokEthMinMax("DAI");
    expect(min).to.eq(oraclePrices.DAI_ETH);
    expect(max).to.eq(oraclePrices.DAI_ETH);

    [min, max] = await mixOracle.priceTokEthMinMax("USDT");
    expect(min).to.eq(oraclePrices.USDT_ETH);
    expect(max).to.eq(oraclePrices.USDT_ETH);

    [min, max] = await mixOracle.priceTokEthMinMax("USDC");
    expect(min).to.eq(oraclePrices.USDC_ETH);
    expect(max).to.eq(oraclePrices.USDC_ETH);
  });

});
