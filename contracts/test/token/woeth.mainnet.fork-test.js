const { expect } = require("chai");

const { simpleOETHFixture, createFixtureLoader } = require("./../_fixture");
const { oethUnits } = require("../helpers");

const oethWhaleFixture = async () => {
  const fixture = await simpleOETHFixture();

  const { weth, oeth, oethVault, woeth, domen } = fixture;

  // Domen is a OETH whale
  await oethVault
    .connect(domen)
    .mint(weth.address, oethUnits("20000"), oethUnits("19999"));

  await oeth.connect(domen).approve(woeth.address, oethUnits("20000"));

  return fixture;
};

const loadFixture = createFixtureLoader(oethWhaleFixture);

describe("ForkTest: wOETH", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Deposit should not be manipulated by donations", async () => {
    const { oeth, woeth, domen } = fixture;

    await expect(domen).to.have.approxBalanceOf("0", woeth);

    // Wrap some OETH
    await woeth.connect(domen).deposit(oethUnits("1000"), domen.address);

    const sharePriceBeforeDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );

    // Donate some OETH
    oeth.connect(domen).transfer(woeth.address, oethUnits("10000"));

    // Ensure no change in share price
    const sharePriceAfterDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );
    expect(sharePriceBeforeDonate).to.approxEqual(
      sharePriceAfterDonate,
      "Price manipulation"
    );

    // Wrap again
    await woeth.connect(domen).deposit(oethUnits("1000"), domen.address);

    // Ensure the balance is right
    await expect(domen).to.have.approxBalanceOf(
      // 2000 * 1000 / sharePrice(1000 OETH)
      oethUnits("2000").mul(oethUnits("1000")).div(sharePriceAfterDonate),
      woeth
    );
  });

  it("Withdraw should not be manipulated by donations", async () => {
    const { oeth, woeth, domen } = fixture;

    await expect(domen).to.have.approxBalanceOf("0", woeth);
    await expect(domen).to.have.approxBalanceOf("20000", oeth);

    // Wrap some OETH
    await woeth.connect(domen).deposit(oethUnits("3000"), domen.address);

    const sharePriceBeforeDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );

    // Donate some OETH
    oeth.connect(domen).transfer(woeth.address, oethUnits("10000"));

    // Ensure no change in share price
    const sharePriceAfterDonate = await woeth.convertToAssets(
      oethUnits("1000")
    );
    expect(sharePriceBeforeDonate).to.approxEqual(
      sharePriceAfterDonate,
      "Price manipulation"
    );

    // Withdraw
    await woeth
      .connect(domen)
      .withdraw(
        await woeth.maxWithdraw(domen.address),
        domen.address,
        domen.address
      );

    // Ensure balance is right
    await expect(domen).to.have.approxBalanceOf("10000", oeth);
  });
});
