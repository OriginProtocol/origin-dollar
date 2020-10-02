const { expect } = require("chai");

const { BigNumber } = require("ethers");
const { threepoolFixture } = require("../_fixture");
const {
  usdcUnits,
  usdtUnits,
  loadFixture,
  units,
  isGanacheFork,
} = require("../helpers");

describe("3Pool Strategy Standalone", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }
  let governor,
    threePool,
    threePoolToken,
    tpStandalone,
    usdt,
    usdc,
    threePoolStrategy;
  beforeEach(async function () {
    const fixture = await loadFixture(threepoolFixture);
    governor = fixture.governor;
    threePool = fixture.threePool;
    threePoolToken = fixture.threePoolToken;
    tpStandalone = fixture.tpStandalone;
    usdc = fixture.usdc;
    usdt = fixture.usdt;

    threePoolStrategy = tpStandalone.connect(governor);
  });

  const deposit = async (amount, asset) => {
    await asset
      .connect(governor)
      .transfer(threePoolStrategy.address, units(amount, asset));
    await threePoolStrategy.deposit(asset.address, units(amount, asset));
  };

  it("should mint USDT", async function () {
    await expect(governor).has.an.approxBalanceOf("1000", usdt);
    // Verify that we start with no pool tokens
    await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
    // Create 150 USDT, move it to the strategy, and deposit
    await deposit("150", usdt);
    // Verify that we now have some pool tokens
    await expect(threePoolStrategy).has.an.approxBalanceOf(
      "149.8410",
      threePoolToken
    );
    await expect(governor).has.an.approxBalanceOf("850", usdt);
  });
  it("should mint USDC", async function () {
    // Verify that we start with no pool tokens
    await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
    // Create 150 USDC move it to the strategy, and deposit
    await deposit("150", usdc);
    // Verify that we now have some pool tokens
    await expect(threePoolStrategy).has.an.approxBalanceOf(
      "149.9644",
      threePoolToken
    );
  });
  it("should mint USDT and withdraw USDT", async function () {
    threePoolStrategy = tpStandalone.connect(governor);
    await expect(governor).has.an.approxBalanceOf("1000", usdt);

    // Verify that we start with no pool tokens
    await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
    // Create 150 USDT, move it to the strategy, and deposit
    await deposit("150", usdt);
    // Verify that we now have some pool tokens
    await expect(threePoolStrategy).has.an.approxBalanceOf(
      "149.8410",
      threePoolToken
    );
    await expect(governor).has.an.approxBalanceOf("850", usdt);

    // Withdraw
    await threePoolStrategy.withdraw(
      await governor.getAddress(),
      usdt.address,
      usdtUnits("100")
    );
    await expect(governor).has.an.approxBalanceOf("950", usdt);
    await expect(threePoolStrategy).has.an.approxBalanceOf(
      "49.9088",
      threePoolToken
    );
    await threePoolStrategy.withdraw(
      await governor.getAddress(),
      usdt.address,
      usdtUnits("49.90")
    );
    await expect(governor).has.an.approxBalanceOf("999.90", usdt);
  });

  it("should mint USDT and Liqidate a mix", async function () {
    threePoolStrategy = tpStandalone.connect(governor);
    await expect(governor).has.an.approxBalanceOf("1000", usdt);

    // Verify that we start with no pool tokens
    await expect(threePoolStrategy).has.a.balanceOf("0", threePoolToken);
    // Create 150 USDT, move it to the strategy, and deposit
    await deposit("150", usdt);
    // Verify that we now have some pool tokens
    await expect(threePoolStrategy).has.an.approxBalanceOf(
      "149.8410",
      threePoolToken
    );
    await expect(governor).has.an.approxBalanceOf("1000", usdc);
    await expect(governor).has.an.approxBalanceOf("850", usdt);

    await threePoolStrategy.liquidate();
    await expect(threePoolStrategy).has.an.approxBalanceOf("0", threePoolToken);
    await expect(governor).has.an.approxBalanceOf("1074.90", usdc);
    await expect(governor).has.an.approxBalanceOf("924.97", usdt);
  });
  it("should allow safeApproveAllTokens to be called", async function () {
    threePoolStrategy = tpStandalone.connect(governor);
    const MAX = BigNumber.from(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const expectAllowanceRaw = async (expected, asset) => {
      const allowance = await asset.allowance(
        threePoolStrategy.address,
        threePool.address
      );
      await expect(allowance).to.eq(expected);
    };
    await expectAllowanceRaw(MAX, usdt);
    await expectAllowanceRaw(MAX, usdc);
    await deposit("100", usdc);
    await deposit("150", usdt);
    await expectAllowanceRaw(
      MAX.sub((await units("100.0", usdc)).toString()),
      usdc
    );
    await expectAllowanceRaw(
      MAX.sub((await units("150.0", usdt)).toString()),
      usdt
    );
    await threePoolStrategy.safeApproveAllTokens();
    await expectAllowanceRaw(MAX, usdt);
    await expectAllowanceRaw(MAX, usdc);
  });
});
