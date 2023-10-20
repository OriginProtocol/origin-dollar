const { expect } = require("chai");

const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, oethUnits } = require("../helpers");

const loadFixture = createFixtureLoader(buybackFixture);

describe("Buyback", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should swap OETH and OUSD for OGV and CVX", async () => {
    const {
      oeth,
      ousd,
      cvx,
      ogv,
      buyback,
      strategist,
      cvxLocker,
      rewardsSource,
    } = fixture;

    await buyback
      .connect(strategist)
      .swap(
        oethUnits("1"),
        oethUnits("100000"),
        oethUnits("100"),
        oethUnits("1000"),
        oethUnits("80000"),
        oethUnits("80")
      );

    // Check balance after swap
    await expect(buyback).to.have.a.balanceOf(oethUnits("2"), oeth);
    await expect(buyback).to.have.a.balanceOf(oethUnits("2000"), ousd);

    // Ensure OGV went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(oethUnits("180000"), ogv);

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      ousdUnits("180")
    );
    await expect(cvxLocker).to.have.balanceOf(ousdUnits("180"), cvx);
  });

  it("Should swap OETH for OGV and CVX", async () => {
    const {
      oeth,
      ousd,
      cvx,
      ogv,
      buyback,
      strategist,
      cvxLocker,
      rewardsSource,
    } = fixture;

    await buyback
      .connect(strategist)
      .swapOETH(oethUnits("1"), oethUnits("100000"), oethUnits("100"));

    // Check balance after swap
    await expect(buyback).to.have.a.balanceOf(oethUnits("2"), oeth);
    await expect(buyback).to.have.a.balanceOf(oethUnits("3000"), ousd);

    // Ensure OGV went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(oethUnits("100000"), ogv);

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      ousdUnits("100")
    );
    await expect(cvxLocker).to.have.balanceOf(ousdUnits("100"), cvx);
  });

  it("Should swap OUSD for OGV and CVX", async () => {
    const {
      oeth,
      ousd,
      cvx,
      ogv,
      buyback,
      strategist,
      cvxLocker,
      rewardsSource,
    } = fixture;

    await buyback
      .connect(strategist)
      .swapOUSD(oethUnits("1000"), oethUnits("80000"), oethUnits("80"));

    // Check balance after swap
    await expect(buyback).to.have.a.balanceOf(oethUnits("3"), oeth);
    await expect(buyback).to.have.a.balanceOf(oethUnits("2000"), ousd);

    // Ensure OGV went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(oethUnits("80000"), ogv);

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      ousdUnits("80")
    );
    await expect(cvxLocker).to.have.balanceOf(ousdUnits("80"), cvx);
  });

  it("Should NOT swap when called by someone else", async () => {
    const { anna, buyback } = fixture;

    const ousdAmount = ousdUnits("1000");

    await expect(
      buyback.connect(anna).swap(ousdAmount, 0, 0, 0, 0, 0)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(
      buyback.connect(anna).swapOETH(ousdAmount, 1, 1)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
    await expect(
      buyback.connect(anna).swapOUSD(ousdAmount, 1, 1)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should NOT swap when swap amount is invalid", async () => {
    const { buyback, strategist } = fixture;

    await expect(
      buyback.connect(strategist).swap(0, 0, 0, 0, 0, 0)
    ).to.be.revertedWith("Invalid Swap Amounts");
    await expect(
      buyback.connect(strategist).swapOETH(0, 0, 0)
    ).to.be.revertedWith("Invalid Swap Amount");
    await expect(
      buyback.connect(strategist).swapOUSD(0, 0, 0)
    ).to.be.revertedWith("Invalid Swap Amount");
  });

  it("Should allow Governor to set Trustee address", async () => {
    const { vault, governor, ousd } = fixture;
    // Pretend OUSD is trustee
    await vault.connect(governor).setTrusteeAddress(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address", async () => {
    const { vault, anna, ousd } = fixture;
    // Pretend OUSD is trustee
    await expect(
      vault.connect(anna).setTrusteeAddress(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Uniswap Router address", async () => {
    const { buyback, governor, ousd } = fixture;
    // Pretend OUSD is a uniswap
    await buyback.connect(governor).setUniswapUniversalRouter(ousd.address);
    expect(await buyback.universalRouter()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Uniswap Router address", async () => {
    const { buyback, anna, ousd } = fixture;
    // Pretend OUSD is uniswap
    await expect(
      buyback.connect(anna).setUniswapUniversalRouter(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Strategist address", async () => {
    const { buyback, governor, ousd } = fixture;
    // Pretend OUSD is a Strategist
    await buyback.connect(governor).setStrategistAddr(ousd.address);
    expect(await buyback.strategistAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Strategist address", async () => {
    const { buyback, anna, ousd } = fixture;
    // Pretend OUSD is Strategist
    await expect(
      buyback.connect(anna).setStrategistAddr(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should NOT swap when uniswap address isn't set", async () => {
    const { governor, buyback } = fixture;
    // await fundBuybackAndUniswap(fixture);

    // Set Uniswap Address to 0x0
    await buyback
      .connect(governor)
      .setUniswapUniversalRouter("0x0000000000000000000000000000000000000000");
    expect(await buyback.universalRouter()).to.be.equal(
      "0x0000000000000000000000000000000000000000"
    );

    const ousdAmount = ousdUnits("1000");

    await expect(
      buyback.connect(governor).swap(ousdAmount, 10, 10, ousdAmount, 10, 10)
    ).to.be.revertedWith("Uniswap Router not set");

    await expect(
      buyback.connect(governor).swapOUSD(ousdAmount, 10, 10)
    ).to.be.revertedWith("Uniswap Router not set");

    await expect(
      buyback.connect(governor).swapOETH(ousdAmount, 10, 10)
    ).to.be.revertedWith("Uniswap Router not set");
  });

  it("Should NOT swap when min expected is zero", async () => {
    const { governor, buyback } = fixture;
    await expect(
      buyback.connect(governor).swap(10, 0, 10, 10, 10, 10)
    ).to.be.revertedWith("Invalid minAmount for OETH>OGV");

    await expect(
      buyback.connect(governor).swap(10, 10, 0, 10, 10, 10)
    ).to.be.revertedWith("Invalid minAmount for OETH>CVX");

    await expect(
      buyback.connect(governor).swap(10, 10, 10, 10, 0, 10)
    ).to.be.revertedWith("Invalid minAmount for OUSD>OGV");

    await expect(
      buyback.connect(governor).swap(10, 10, 10, 10, 10, 0)
    ).to.be.revertedWith("Invalid minAmount for OUSD>CVX");
  });

  it("Should allow withdrawal of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor, buyback } = fixture;
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(buyback.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await buyback
      .connect(governor)
      .transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow withdrawal of arbitrary token by non-Governor", async () => {
    const { buyback, ousd, matt, strategist } = fixture;
    // Naughty Matt
    await expect(
      buyback.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");

    // Make sure strategist can't do that either
    await expect(
      buyback.connect(strategist).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to change RewardsSource address", async () => {
    const { buyback, governor, matt } = fixture;

    await buyback.connect(governor).setRewardsSource(matt.address);

    expect(await buyback.rewardsSource()).to.equal(matt.address);
  });

  it("Should not allow anyone else to change RewardsSource address", async () => {
    const { buyback, strategist, matt, josh } = fixture;

    for (const user of [strategist, josh]) {
      await expect(
        buyback.connect(user).setRewardsSource(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should not allow setting RewardsSource address to address(0)", async () => {
    const { buyback, governor } = fixture;

    await expect(
      buyback
        .connect(governor)
        .setRewardsSource("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Address not set");
  });

  it("Should allow Governor to change Treasury manager address", async () => {
    const { buyback, governor, matt } = fixture;

    await buyback.connect(governor).setTreasuryManager(matt.address);

    expect(await buyback.treasuryManager()).to.equal(matt.address);
  });

  it("Should not allow setting Treasury manager address to address(0)", async () => {
    const { buyback, governor } = fixture;

    expect(
      buyback
        .connect(governor)
        .setTreasuryManager("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Address not set");
  });

  it("Should not allow anyone else to change Treasury manager address", async () => {
    const { buyback, strategist, matt, josh } = fixture;

    for (const user of [strategist, josh]) {
      await expect(
        buyback.connect(user).setTreasuryManager(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });
});
