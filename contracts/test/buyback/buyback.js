const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { loadDefaultFixture } = require("../fixture/_fixture");
const { ousdUnits, usdcUnits } = require("../helpers");

describe("OGV Buyback", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
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

  it("Should allow Governor to set Uniswap address", async () => {
    const { buyback, governor, ousd } = fixture;
    // Pretend OUSD is a uniswap
    await buyback.connect(governor).setUniswapAddr(ousd.address);
    expect(await buyback.uniswapAddr()).to.be.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Uniswap address", async () => {
    const { buyback, anna, ousd } = fixture;
    // Pretend OUSD is uniswap
    await expect(
      buyback.connect(anna).setUniswapAddr(ousd.address)
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

  it("Should NOT swap OUSD balance for OGV when called by vault", async () => {
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

  it("Should distribute and swap OUSD when called by strategist", async () => {
    const { ousd, ogn, ogv, strategist, governor, buyback, rewardsSource } =
      fixture;
    await fundBuybackAndUniswap(fixture);

    await buyback.connect(governor).setTreasuryBps("5000");

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("500", 18);
    await buyback.connect(strategist).distributeAndSwap(ousdAmount, minOGV);

    // Should've transferred the treasury's share of  500 OUSD
    await expect(strategist).has.a.balanceOf("500", ousd);

    // Should've swapped 500 OUSD for OGV
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("500", ogv);
    await expect(buyback).has.a.balanceOf("0", ousd);
  });

  it("Should just distribute when treasuryBps is 100%", async () => {
    const { ousd, ogn, ogv, strategist, governor, buyback, rewardsSource } =
      fixture;
    await fundBuybackAndUniswap(fixture);

    await buyback.connect(governor).setTreasuryBps("10000");

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("0", 18);
    await buyback.connect(strategist).distributeAndSwap(ousdAmount, minOGV);

    // Should've transferred the treasury's share
    await expect(strategist).has.a.balanceOf("1000", ousd);

    // Should not have swapped for OGV
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("0", ousd);
  });

  it("Should just swap when treasuryBps is 0%", async () => {
    const { ousd, ogn, ogv, strategist, governor, buyback, rewardsSource } =
      fixture;
    await fundBuybackAndUniswap(fixture);

    await buyback.connect(governor).setTreasuryBps("0");

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("1000", 18);
    await buyback.connect(strategist).distributeAndSwap(ousdAmount, minOGV);

    // Shouldn't have transferred anything for treasury
    await expect(strategist).has.a.balanceOf("0", ousd);

    // Should've swapped 1000 OUSD for OGV
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("1000", ogv);
    await expect(buyback).has.a.balanceOf("0", ousd);
  });

  it("Should NOT distribute/swap when called by someone else", async () => {
    const { ousd, ogn, ogv, anna, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("456456", 18);

    await expect(
      buyback.connect(anna).distributeAndSwap(ousdAmount, minOGV)
    ).to.be.revertedWith("Caller is not the Strategist or Governor");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should NOT distribute/swap when uniswap address isn't set", async () => {
    const { ousd, ogn, ogv, governor, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    // Set Uniswap Address to 0x0
    await buyback
      .connect(governor)
      .setUniswapAddr("0x0000000000000000000000000000000000000000");
    expect(await buyback.uniswapAddr()).to.be.equal(
      "0x0000000000000000000000000000000000000000"
    );

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = utils.parseUnits("1000", 18);

    await expect(
      buyback.connect(governor).distributeAndSwap(ousdAmount, minOGV)
    ).to.be.revertedWith("Exchange address not set");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
  });

  it("Should NOT distribute/swap when min expected is zero", async () => {
    const { ousd, ogn, ogv, governor, buyback, rewardsSource } = fixture;
    await fundBuybackAndUniswap(fixture);

    const ousdAmount = utils.parseUnits("1000", 18);
    const minOGV = BigNumber.from("0");

    await expect(
      buyback.connect(governor).distributeAndSwap(ousdAmount, minOGV)
    ).to.be.revertedWith("Invalid minOGVExpected value");

    // Shouldn't have swapped anything
    await expect(buyback).has.a.balanceOf("0", ogn);
    await expect(buyback).has.a.balanceOf("0", ogv);
    await expect(rewardsSource).has.a.balanceOf("0", ogn);
    await expect(rewardsSource).has.a.balanceOf("0", ogv);
    await expect(buyback).has.a.balanceOf("1000", ousd);
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
      expect(
        buyback.connect(user).setRewardsSource(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should not allow setting RewardsSource address to address(0)", async () => {
    const { buyback, governor } = fixture;

    expect(
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
      expect(
        buyback.connect(user).setTreasuryManager(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should allow Governor to change Treasury Bips", async () => {
    const { buyback, governor } = fixture;

    await buyback.connect(governor).setTreasuryBps("1234");

    expect(await buyback.treasuryBps()).to.equal("1234");
  });

  it("Should not allow anyone else to change Treasury Bips", async () => {
    const { buyback, strategist, franck } = fixture;

    for (const user of [strategist, franck]) {
      await expect(
        buyback.connect(user).setTreasuryBps("123")
      ).to.be.revertedWith("Caller is not the Governor");
    }
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
