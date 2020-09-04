const { expect } = require("chai");
const { defaultFixture } = require("./_fixture");
const { isGanacheFork, oracleUnits, loadFixture } = require("./helpers");

describe("Oracle", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Should allow multiple prices to be set and read", async () => {
    const { oracle } = await loadFixture(defaultFixture);
    await oracle.setPrice("DAI", oracleUnits("1.02"));
    await oracle.setPrice("USDT", oracleUnits("0.96"));
    expect(await oracle.price("DAI")).to.eq(oracleUnits("1.02"));
    expect(await oracle.price("USDT")).to.eq(oracleUnits("0.96"));
  });

  it.only("Chainink oracle", async () => {
    const { chainlinkOracle, chainlinkOracleFeedETH, chainlinkOracleFeedDAI, chainlinkOracleFeedUSDT, chainlinkOracleFeedUSDC } = await loadFixture(defaultFixture);

    // Set the price of 1 ETH to $370
    await chainlinkOracleFeedETH.setPrice(oracleUnits("370"))
    expect(await chainlinkOracle.price("ETH")).to.eq(oracleUnits("370"));

    // Set the price of 1 DAI to 1/370 ETH = 0.002702 ETH = ~$0.999740
    await chainlinkOracleFeedDAI.setPrice(oracleUnits("0.002702"))
    expect(await chainlinkOracle.price("DAI")).to.eq(oracleUnits("0.999740"));

    // Set the price of 1 USDT to 1/360 ETH = 0.002777 ETH = ~$1.027490
    await chainlinkOracleFeedUSDT.setPrice(oracleUnits("0.002777"))
    expect(await chainlinkOracle.price("USDT")).to.eq(oracleUnits("1.027490"));

    // Set the price of 1 USDC to 1/250 ETH = 0.004 ETH = $1.48
    await chainlinkOracleFeedUSDC.setPrice(oracleUnits("0.004"))
    expect(await chainlinkOracle.price("USDC")).to.eq(oracleUnits("1.48"));
  });

});
