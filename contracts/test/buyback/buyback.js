const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { defaultFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, loadFixture } = require("../helpers");

describe("OGV Buyback", function () {
  it("Should allow Governor to set Trustee address", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is trustee
    await vault.connect(governor).setTrusteeAddress(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address", async () => {
    const { vault, anna, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is trustee
    await expect(
      vault.connect(anna).setTrusteeAddress(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Uniswap address", async () => {
    const { buyback, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a uniswap
    await buyback.connect(governor).setUniswapAddr(ousd.address);
    expect(await buyback.uniswapAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Uniswap address", async () => {
    const { buyback, anna, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is uniswap
    await expect(
      buyback.connect(anna).setUniswapAddr(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Strategist address", async () => {
    const { buyback, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is a Strategist
    await buyback.connect(governor).setStrategistAddr(ousd.address);
    expect(await buyback.strategistAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Strategist address", async () => {
    const { buyback, anna, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is Strategist
    await expect(
      buyback.connect(anna).setStrategistAddr(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should NOT swap OUSD balance for OGV when called by vault", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { ousd, ogn, ogv, governor, buyback, vault, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    // Calling allocate on Vault calls buyback.swap()
    await vault.connect(governor).allocate();

    // Currently disabled, so shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should swap when called by strategist", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { ousd, ogn, ogv, strategist, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("1000", 18);
    await buyback.connect(strategist).swapNow(ousdAmount, minOGV);

    // Should've swapped for OGV
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("1000", ogv);
    await expect(buyback).has.a.balanceOf("0", ousd);
  });

  it("Should NOT swap when called by someone else", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { ousd, ogn, ogv, anna, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("456456", 18);

    await expect(
      buyback.connect(anna).swapNow(ousdAmount, minOGV)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should NOT swap when uniswap address isn't set", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { ousd, ogn, ogv, governor, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    // Set Uniswap Address to 0x0
    await buyback.connect(governor).setUniswapAddr('0x0000000000000000000000000000000000000000');
    expect(await buyback.uniswapAddr()).to.be.equal('0x0000000000000000000000000000000000000000');

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("1000", 18);

    await expect(
      buyback.connect(governor).swapNow(ousdAmount, minOGV)
    ).to.be.revertedWith("Exchange address not set");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should NOT swap when min expected is zero", async () => {
    const fixture = await loadFixture(defaultFixture);
    const { ousd, ogn, ogv, governor, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = BigNumber.from("0")

    await expect(
      buyback.connect(governor).swapNow(ousdAmount, minOGV)
    ).to.be.revertedWith("Invalid minExpected value");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should allow withdrawal of arbitrary token by Governor", async () => {
    const { vault, ousd, usdc, matt, governor, buyback } = await loadFixture(
      defaultFixture
    );
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
    const { buyback, ousd, matt, strategist } = await loadFixture(
      defaultFixture
    );
    // Naughty Matt
    await expect(
      buyback.connect(matt).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");

    // Make sure strategist can't do that either
    await expect(
      buyback.connect(strategist).transferToken(ousd.address, ousdUnits("8.0"))
    ).to.be.revertedWith("Caller is not the Governor");
  });
});

async function fundBuybackAndUniswap(fixture) {
  const { matt, ogn, ogv, ousd, buyback, dai, vault } = fixture;

  const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");
  await mockUniswapRouter.initialize([ousd.address], [ogv.address]);

  // Give Uniswap some mock OGN and OGV so it can swap
  for (const token of [ogn, ogv]) {
    await token.connect(matt).mint(utils.parseUnits("1000", 18));
    await token
      .connect(matt)
      .transfer(mockUniswapRouter.address, utils.parseUnits("1000", 18));
  }

  // Get OUSD for the buyback contract to use
  await dai.connect(matt).mint(utils.parseUnits("1000", 18));
  await dai.connect(matt).approve(vault.address, utils.parseUnits("1000", 18));
  await vault.connect(matt).mint(dai.address, utils.parseUnits("1000", 18), 0);

  // Give the Buyback contract some OUSD to trigger the swap
  await ousd
    .connect(matt)
    .transfer(buyback.address, utils.parseUnits("1000", 18));
}
