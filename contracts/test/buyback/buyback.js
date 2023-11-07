const { expect } = require("chai");

const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, oethUnits } = require("../helpers");

const loadFixture = createFixtureLoader(buybackFixture);

describe("Buyback", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should swap OETH for OGV and CVX", async () => {
    const {
      oeth,
      cvx,
      ogv,
      oethBuyback,
      strategist,
      cvxLocker,
      rewardsSource,
    } = fixture;

    await oethBuyback
      .connect(strategist)
      .swap(oethUnits("1"), oethUnits("100000"), oethUnits("100"));

    // Check balance after swap
    await expect(oethBuyback).to.have.a.balanceOf(oethUnits("2"), oeth);

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
      ousd,
      cvx,
      ogv,
      ousdBuyback,
      strategist,
      cvxLocker,
      rewardsSource,
    } = fixture;

    await ousdBuyback
      .connect(strategist)
      .swap(oethUnits("1000"), oethUnits("80000"), oethUnits("80"));

    // Check balance after swap
    await expect(ousdBuyback).to.have.a.balanceOf(oethUnits("2000"), ousd);

    // Ensure OGV went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(oethUnits("80000"), ogv);

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      ousdUnits("80")
    );
    await expect(cvxLocker).to.have.balanceOf(ousdUnits("80"), cvx);
  });

  it("Should NOT swap when called by someone else", async () => {
    const { anna, ousdBuyback } = fixture;

    const ousdAmount = ousdUnits("1000");

    await expect(
      ousdBuyback.connect(anna).swap(ousdAmount, 1, 1)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should NOT swap when swap amount is invalid", async () => {
    const { ousdBuyback, strategist } = fixture;

    await expect(
      ousdBuyback.connect(strategist).swap(0, 0, 0)
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
    const { ousdBuyback, governor, ousd } = fixture;
    // Pretend OUSD is a uniswap
    await ousdBuyback.connect(governor).setUniswapUniversalRouter(ousd.address);
    expect(await ousdBuyback.universalRouter()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Uniswap Router address", async () => {
    const { ousdBuyback, anna, ousd } = fixture;
    // Pretend OUSD is uniswap
    await expect(
      ousdBuyback.connect(anna).setUniswapUniversalRouter(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Strategist address", async () => {
    const { ousdBuyback, governor, ousd } = fixture;
    // Pretend OUSD is a Strategist
    await ousdBuyback.connect(governor).setStrategistAddr(ousd.address);
    expect(await ousdBuyback.strategistAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Strategist address", async () => {
    const { ousdBuyback, anna, ousd } = fixture;
    // Pretend OUSD is Strategist
    await expect(
      ousdBuyback.connect(anna).setStrategistAddr(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should NOT swap when uniswap address isn't set", async () => {
    const { governor, ousdBuyback } = fixture;
    // await fundBuybackAndUniswap(fixture);

    // Set Uniswap Address to 0x0
    await ousdBuyback
      .connect(governor)
      .setUniswapUniversalRouter("0x0000000000000000000000000000000000000000");
    expect(await ousdBuyback.universalRouter()).to.be.equal(
      "0x0000000000000000000000000000000000000000"
    );

    const ousdAmount = ousdUnits("1000");

    await expect(
      ousdBuyback.connect(governor).swap(ousdAmount, 10, 10)
    ).to.be.revertedWith("Uniswap Router not set");
  });

  it("Should NOT swap when min expected is zero", async () => {
    const { governor, ousdBuyback } = fixture;
    await expect(
      ousdBuyback.connect(governor).swap(10, 0, 10)
    ).to.be.revertedWith("Invalid minAmount for OGV");

    await expect(
      ousdBuyback.connect(governor).swap(10, 10, 0)
    ).to.be.revertedWith("Invalid minAmount for CVX");
  });

  it("Should allow withdrawal of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor, ousdBuyback } = fixture;
    // Matt deposits USDC, 6 decimals
    await usdc.connect(matt).approve(vault.address, usdcUnits("8.0"));
    await vault.connect(matt).mint(usdc.address, usdcUnits("8.0"), 0);
    // Matt sends his OUSD directly to Vault
    await ousd.connect(matt).transfer(ousdBuyback.address, ousdUnits("8.0"));
    // Matt asks Governor for help
    await ousdBuyback
      .connect(governor)
      .transferToken(ousd.address, ousdUnits("8.0"));
    await expect(governor).has.a.balanceOf("8.0", ousd);
  });

  it("Should not allow withdrawal of arbitrary token by non-Governor", async () => {
    const { ousdBuyback, ousd, matt, strategist } = fixture;
    // Naughty Matt
    await expect(
      ousdBuyback.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");

    // Make sure strategist can't do that either
    await expect(
      ousdBuyback
        .connect(strategist)
        .transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to change RewardsSource address", async () => {
    const { ousdBuyback, governor, matt } = fixture;

    await ousdBuyback.connect(governor).setRewardsSource(matt.address);

    expect(await ousdBuyback.rewardsSource()).to.equal(matt.address);
  });

  it("Should not allow anyone else to change RewardsSource address", async () => {
    const { ousdBuyback, strategist, matt, josh } = fixture;

    for (const user of [strategist, josh]) {
      await expect(
        ousdBuyback.connect(user).setRewardsSource(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should not allow setting RewardsSource address to address(0)", async () => {
    const { ousdBuyback, governor } = fixture;

    await expect(
      ousdBuyback
        .connect(governor)
        .setRewardsSource("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Address not set");
  });

  it("Should allow Governor to change Treasury manager address", async () => {
    const { ousdBuyback, governor, matt } = fixture;

    await ousdBuyback.connect(governor).setTreasuryManager(matt.address);

    expect(await ousdBuyback.treasuryManager()).to.equal(matt.address);
  });

  it("Should not allow setting Treasury manager address to address(0)", async () => {
    const { ousdBuyback, governor } = fixture;

    expect(
      ousdBuyback
        .connect(governor)
        .setTreasuryManager("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Address not set");
  });

  it("Should not allow anyone else to change Treasury manager address", async () => {
    const { ousdBuyback, strategist, matt, josh } = fixture;

    for (const user of [strategist, josh]) {
      await expect(
        ousdBuyback.connect(user).setTreasuryManager(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });
});
