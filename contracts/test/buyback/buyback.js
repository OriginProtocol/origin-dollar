const { expect } = require("chai");

const { createFixtureLoader, buybackFixture } = require("../_fixture");
const { ousdUnits, usdcUnits, oethUnits, isCI } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");
const { setStorageAt } = require("@nomicfoundation/hardhat-network-helpers");

const loadFixture = createFixtureLoader(buybackFixture);

describe("Buyback", function () {
  let fixture;

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  beforeEach(async () => {
    fixture = await loadFixture();
  });

  it("Should swap OETH for OGN", async () => {
    const { oeth, ogn, oethBuyback, strategist, rewardsSource } = fixture;

    await oethBuyback
      .connect(strategist)
      .swapForOGN(oethUnits("1"), oethUnits("100000"), "0x00000000");

    // Check balance after swap
    await expect(oethBuyback).to.have.a.balanceOf(oethUnits("2"), oeth);

    expect(await oethBuyback.balanceForOGN()).to.equal(oethUnits("0.5"));
    expect(await oethBuyback.balanceForCVX()).to.equal(oethUnits("1.5"));

    // Ensure OGN went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(oethUnits("100000"), ogn);
  });

  it("Should swap OETH for CVX", async () => {
    const { oeth, oethBuyback, strategist, cvx, cvxLocker } = fixture;

    await oethBuyback
      .connect(strategist)
      .swapForCVX(oethUnits("1"), oethUnits("100"), "0x00000000");

    // Check balance after swap
    await expect(oethBuyback).to.have.a.balanceOf(oethUnits("2"), oeth);

    expect(await oethBuyback.balanceForOGN()).to.equal(oethUnits("1.5"));

    expect(await oethBuyback.balanceForCVX()).to.equal(oethUnits("0.5"));

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      oethUnits("100")
    );
    await expect(cvxLocker).to.have.balanceOf(oethUnits("100"), cvx);
  });

  it("Should swap OUSD for OGN", async () => {
    const { ousd, ogn, ousdBuyback, strategist, rewardsSource } = fixture;

    await ousdBuyback
      .connect(strategist)
      .swapForOGN(ousdUnits("1250"), ousdUnits("100000"), "0x00000000");

    // Check balance after swap
    await expect(ousdBuyback).to.have.a.balanceOf(ousdUnits("1750"), ousd);

    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("250"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    // Ensure OGN went to RewardsSource contract
    await expect(rewardsSource).to.have.balanceOf(ousdUnits("100000"), ogn);
  });

  it("Should swap OUSD for CVX", async () => {
    const { ousd, ousdBuyback, strategist, cvx, cvxLocker } = fixture;

    await ousdBuyback
      .connect(strategist)
      .swapForCVX(ousdUnits("750"), ousdUnits("100"), "0x00000000");

    // Check balance after swap
    await expect(ousdBuyback).to.have.a.balanceOf(ousdUnits("2250"), ousd);

    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("1500"));

    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("750"));

    // Ensure it locked CVX
    expect(await cvxLocker.lockedBalanceOf(strategist.address)).to.equal(
      ousdUnits("100")
    );
    await expect(cvxLocker).to.have.balanceOf(ousdUnits("100"), cvx);
  });

  it("Should NOT swap OGN when called by someone else", async () => {
    const { anna, ousdBuyback } = fixture;

    const ousdAmount = ousdUnits("1000");

    await expect(
      ousdBuyback.connect(anna).swapForOGN(ousdAmount, 1, "0x00000000")
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should NOT swap CVX when called by someone else", async () => {
    const { anna, ousdBuyback } = fixture;

    const ousdAmount = ousdUnits("1000");

    await expect(
      ousdBuyback.connect(anna).swapForCVX(ousdAmount, 1, "0x00000000")
    ).to.be.revertedWith("Caller is not the Strategist or Governor");
  });

  it("Should NOT swap when swap amount is invalid", async () => {
    const { ousdBuyback, strategist } = fixture;

    await expect(
      ousdBuyback.connect(strategist).swapForCVX(0, 0, "0x00000000")
    ).to.be.revertedWith("Invalid Swap Amount");
  });

  it("Should NOT swap when swapper isn't set", async () => {
    const { governor, ousdBuyback } = fixture;

    // Set Swap Router Address to 0x0
    await ousdBuyback.connect(governor).setSwapRouter(addresses.zero);
    expect(await ousdBuyback.swapRouter()).to.be.equal(addresses.zero);

    const ousdAmount = ousdUnits("1000");

    await expect(
      ousdBuyback.connect(governor).swapForOGN(ousdAmount, 10, "0x00000000")
    ).to.be.revertedWith("Swap Router not set");
  });

  it("Should NOT swap when min expected is zero", async () => {
    const { governor, ousdBuyback } = fixture;
    await expect(
      ousdBuyback.connect(governor).swapForOGN(10, 0, "0x00000000")
    ).to.be.revertedWith("Invalid minAmount");

    await expect(
      ousdBuyback.connect(governor).swapForCVX(10, 0, "0x00000000")
    ).to.be.revertedWith("Invalid minAmount");
  });

  it("Should NOT swap OGN when RewardsSource isn't set", async () => {
    const { governor, ousdBuyback } = fixture;

    // Set RewardsSource to zero
    await setStorageAt(
      ousdBuyback.address,
      "0x6b",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    await expect(
      ousdBuyback.connect(governor).swapForOGN(10, 10, "0x00000000")
    ).to.be.revertedWith("RewardsSource contract not set");
  });

  it("Should NOT swap OGN/CVX when balance underflow", async () => {
    const { governor, ousdBuyback } = fixture;

    await expect(
      ousdBuyback
        .connect(governor)
        .swapForOGN(ousdUnits("2000"), 10, "0x00000000")
    ).to.be.revertedWith("Balance underflow");

    await expect(
      ousdBuyback
        .connect(governor)
        .swapForCVX(ousdUnits("2000"), 10, "0x00000000")
    ).to.be.revertedWith("Balance underflow");
  });

  it("Should revert when slippage is higher", async () => {
    const { governor, ousdBuyback, mockSwapper } = fixture;

    await mockSwapper.setNextOutAmount(ousdUnits("100"));

    await expect(
      ousdBuyback
        .connect(governor)
        .swapForOGN(ousdUnits("100"), ousdUnits("1000"), "0x00000000")
    ).to.be.revertedWith("Higher Slippage");
  });

  it("Should allow Governor to set Trustee address on Vault", async () => {
    const { vault, governor, ousd } = fixture;
    // Pretend OUSD is Treasury Manager
    await vault.connect(governor).setTrusteeAddress(ousd.address);

    expect(await vault.trusteeAddress()).to.equal(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address on Vault", async () => {
    const { vault, anna, ousd } = fixture;
    // Pretend OUSD is Treasury Manager
    await expect(
      vault.connect(anna).setTrusteeAddress(ousd.address)
    ).to.be.revertedWith("Caller is not the Governor");
  });

  it("Should allow Governor to set Swap Router address", async () => {
    const { ousdBuyback, governor, ousd } = fixture;
    // Pretend OUSD is Swap Router
    await ousdBuyback.connect(governor).setSwapRouter(ousd.address);

    expect(await ousdBuyback.swapRouter()).to.equal(ousd.address);
  });

  it("Should revoke allowance on older Swap Router", async () => {
    const { ousdBuyback, governor, mockSwapper, ousd, ogn, cvx } = fixture;

    const mockSigner = await impersonateAndFund(ousdBuyback.address);

    await cvx
      .connect(mockSigner)
      .approve(mockSwapper.address, ousdUnits("10000"));

    await ogn
      .connect(mockSigner)
      .approve(mockSwapper.address, ousdUnits("12300"));

    // Pretend OUSD is Swap Router
    await ousdBuyback.connect(governor).setSwapRouter(ousd.address);

    expect(await ousdBuyback.swapRouter()).to.equal(ousd.address);

    // Ensure allowance is removed
    expect(
      await ogn.allowance(ousdBuyback.address, mockSwapper.address)
    ).to.equal(0);

    expect(
      await cvx.allowance(ousdBuyback.address, mockSwapper.address)
    ).to.equal(0);
  });

  it("Should not allow non-Governor to set Swap Router address", async () => {
    const { ousdBuyback, anna, ousd } = fixture;
    // Pretend OUSD is Swap Router
    await expect(
      ousdBuyback.connect(anna).setSwapRouter(ousd.address)
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

  it("Should lock all CVX", async () => {
    const { ousdBuyback, cvx, cvxLocker, governor } = fixture;

    await setERC20TokenBalance(ousdBuyback.address, cvx, "1000");

    await ousdBuyback.connect(governor).lockAllCVX();

    await expect(cvxLocker).to.have.balanceOf(oethUnits("1000"), cvx);
  });

  it("Should not allow anyone else to lock CVX", async () => {
    const { ousdBuyback, matt, josh, domen } = fixture;

    for (const signer of [matt, josh, domen]) {
      await expect(ousdBuyback.connect(signer).lockAllCVX()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    }
  });

  it("Should not lock if treasury manager isn't set", async () => {
    const { ousdBuyback, cvx, governor } = fixture;

    await setERC20TokenBalance(ousdBuyback.address, cvx, "1000");

    // Set treasury manager to zero
    await setStorageAt(
      ousdBuyback.address,
      "0x6c",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    await expect(ousdBuyback.connect(governor).lockAllCVX()).to.be.revertedWith(
      "Treasury manager address not set"
    );
  });

  it("Should allow governance to update CVX bps", async () => {
    const { ousdBuyback, governor } = fixture;

    await ousdBuyback.connect(governor).setCVXShareBps(1000);

    expect(await ousdBuyback.cvxShareBps()).to.equal(1000);
  });

  it("Should not allow anyone else to update CVX bps", async () => {
    const { ousdBuyback, matt, josh, domen } = fixture;

    for (const signer of [matt, josh, domen]) {
      await expect(
        ousdBuyback.connect(signer).setCVXShareBps(3000)
      ).to.be.revertedWith("Caller is not the Governor");
    }
  });

  it("Should not allow invalid value", async () => {
    const { ousdBuyback, governor } = fixture;

    await expect(
      ousdBuyback.connect(governor).setCVXShareBps(10001)
    ).to.be.revertedWith("Invalid bps value");
  });

  it("Should handle splits correctly (with 50% for CVX)", async () => {
    const { ousdBuyback, ousd, josh, governor } = fixture;

    // Should have equal shares
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("1500"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    // Set OGN share to zero
    await setStorageAt(
      ousdBuyback.address,
      "0x6e",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // Now contract has 1500 to be split between OGN and CVX
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure distribution
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("750"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("2250"));

    // When there's no unsplit balance, let it do its thing
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure no change distribution
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("750"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("2250"));

    // When there's only one wei extra
    await ousd.connect(josh).transfer(ousdBuyback.address, 1);
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure OGN raised by 1 wei
    expect(await ousdBuyback.balanceForOGN()).to.equal(
      ousdUnits("750").add("1")
    );
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("2250"));
  });

  it("Should handle splits correctly (with 0% for CVX)", async () => {
    const { ousdBuyback, ousd, josh, governor } = fixture;

    // Should have equal shares
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("1500"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    expect(
      await ousdBuyback.connect(governor).setCVXShareBps(0) // 0% for CVX
    );

    // Set OGN share to zero (to mimic some unaccounted balance)
    await setStorageAt(
      ousdBuyback.address,
      "0x6e",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // Now contract has 1500 unaccounted oToken
    // and should allocate it all to OGN
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure distribution
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("1500"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    // When there's no unsplit balance, let it do its thing
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure no change distribution
    expect(await ousdBuyback.balanceForOGN()).to.equal(ousdUnits("1500"));
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    // When there's only one wei extra
    await ousd.connect(josh).transfer(ousdBuyback.address, 1);
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure OGN raised by 1 wei
    expect(await ousdBuyback.balanceForOGN()).to.equal(
      ousdUnits("1500").add("1")
    );
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("1500"));

    // Set CVX share to zero (to mimic some unaccounted balance)
    await setStorageAt(
      ousdBuyback.address,
      "0x6f",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // Now contract has 1500 unaccounted oToken
    // and should allocate it all to OGN
    await ousdBuyback.connect(governor).updateBuybackSplits();

    // Ensure distribution
    expect(await ousdBuyback.balanceForOGN()).to.equal(
      ousdUnits("3000").add("1")
    );
    expect(await ousdBuyback.balanceForCVX()).to.equal(ousdUnits("0"));
  });
});
