const { expect } = require("chai");
const { utils } = require("ethers");

const { loadDefaultFixture } = require("../_fixture");
const { advanceBlocks, isFork } = require("../helpers");

describe("Liquidity Reward", function () {
  if (isFork) {
    this.timeout(0);
  }
  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  it("Campaign can be stopped and started appropriately", async () => {
    const { anna, governor, liquidityRewardOUSD_USDT } = fixture;

    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);

    await expect(
      liquidityRewardOUSD_USDT.connect(anna).stopCampaign()
    ).to.be.revertedWith("Caller is not the Governor");

    liquidityRewardOUSD_USDT.connect(governor).stopCampaign();
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(false);

    const newRewardRate = (await liquidityRewardOUSD_USDT.rewardPerBlock()).mul(
      2
    );
    const newNumBlocks = (6500 * 180) / 2; //6500 * 180 is the estimated number of blocks set for the initial strategy

    await expect(
      liquidityRewardOUSD_USDT
        .connect(anna)
        .startCampaign(newRewardRate, 0, newNumBlocks)
    ).to.be.revertedWith("Caller is not the Governor");

    await expect(
      liquidityRewardOUSD_USDT
        .connect(governor)
        .startCampaign(newRewardRate, 0, newNumBlocks + 1)
    ).to.be.revertedWith("startCampaign: insufficient rewards");

    await liquidityRewardOUSD_USDT
      .connect(governor)
      .startCampaign(newRewardRate, 0, newNumBlocks);
    expect(await liquidityRewardOUSD_USDT.rewardPerBlock()).to.equal(
      newRewardRate
    );
    expect(await liquidityRewardOUSD_USDT.campaignActive()).to.equal(true);
  });

  it("Deposit, then withdraw and claim with correct rewards after 10 blocks", async () => {
    const { ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT } =
      fixture;

    await expect(anna).has.an.approxBalanceOf("1000.00", ogn);

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);
    expect(
      await uniswapPairOUSD_USDT.balanceOf(liquidityRewardOUSD_USDT.address)
    ).to.equal(depositAmount);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.equal("0");

    //advance 10 blocks
    await advanceBlocks(10);
    // we should get all the rewards for 10 blocks since we're the only ones here
    const rewardAmount = rewardPerBlock.mul(10);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      rewardAmount
    );
    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.equal(rewardAmount);

    // +1 block for the withdraw itself
    const withdrawRewardAmount = rewardPerBlock.mul(11);

    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, true);
    const expectedOgn = withdrawRewardAmount.add(utils.parseUnits("1000", 18));
    expect(await ogn.balanceOf(anna.address)).to.equal(expectedOgn);
    expect(await uniswapPairOUSD_USDT.balanceOf(anna.address)).to.equal(
      depositAmount
    );
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
  });

  it("Deposit, extra Transfer, stopCampaign, drain then withdraw and claim with correct rewards after 10 blocks", async () => {
    const {
      ogn,
      anna,
      governor,
      uniswapPairOUSD_USDT,
      liquidityRewardOUSD_USDT,
    } = fixture;

    await expect(anna).has.an.approxBalanceOf("1000.00", ogn);

    const depositAmount = utils.parseUnits("1", 18);

    // extra transfer in
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .transfer(liquidityRewardOUSD_USDT.address, depositAmount);
    // end extra transfer in

    // mint and deposit the LP token into liquidity reward contract
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);
    expect(
      await uniswapPairOUSD_USDT.balanceOf(liquidityRewardOUSD_USDT.address)
    ).to.equal(depositAmount.mul(2));

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.equal("0");

    //advance 10 blocks
    // NOTE: we are only advancing 8 because the extra transfer is a mint + transfer which takes up 2 more blocks
    await advanceBlocks(8);
    // extra transfer in
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .transfer(liquidityRewardOUSD_USDT.address, depositAmount);
    // -----

    // end extra transfer in
    // we should get all the rewards for 10 blocks since we're the only ones here
    const rewardAmount = rewardPerBlock.mul(10);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      rewardAmount
    );
    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.equal(rewardAmount);

    await expect(
      liquidityRewardOUSD_USDT.connect(governor).drainExtraRewards()
    ).to.be.revertedWith("drainExtraRewards:Campaign active");

    await liquidityRewardOUSD_USDT.connect(governor).stopCampaign();

    // +12 block for the drainExtraRewards(failed) and stopCampaign
    const withdrawRewardAmount = rewardPerBlock.mul(12);

    // check on draining extra Rewards
    const preGovRewards = await ogn.balanceOf(governor.address);
    const totalPreRewards = await ogn.balanceOf(
      liquidityRewardOUSD_USDT.address
    );
    await liquidityRewardOUSD_USDT.connect(governor).drainExtraRewards();
    const drainedRewards = (await ogn.balanceOf(governor.address)).sub(
      preGovRewards
    );
    // check that we do have extra rewards
    expect(drainedRewards).to.be.gt("0");
    //check to seee that it's the right amount
    expect(drainedRewards.add(withdrawRewardAmount)).to.approxEqual(
      totalPreRewards
    );

    // check on drainging extra LP
    await liquidityRewardOUSD_USDT.connect(governor).drainExtraLP();
    expect(await uniswapPairOUSD_USDT.balanceOf(governor.address)).to.equal(
      depositAmount.mul(2)
    );

    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, true);
    const expectedOgn = withdrawRewardAmount.add(utils.parseUnits("1000", 18));
    expect(await ogn.balanceOf(anna.address)).to.equal(expectedOgn);
    expect(await uniswapPairOUSD_USDT.balanceOf(anna.address)).to.equal(
      depositAmount
    );
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
    // since rewards and LP are drained, they should be 0
    expect(await ogn.balanceOf(liquidityRewardOUSD_USDT.address)).to.equal("0");
    expect(
      await uniswapPairOUSD_USDT.balanceOf(liquidityRewardOUSD_USDT.address)
    ).to.equal("0");
  });

  it("Deposit, withdraw, and claim separately with correct rewards after 10 blocks", async () => {
    const { ogn, anna, uniswapPairOUSD_USDT, liquidityRewardOUSD_USDT } =
      fixture;

    await expect(anna).has.an.approxBalanceOf("1000.00", ogn);

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

    //advance 10 blocks
    await advanceBlocks(10);

    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, false);
    // no rewards on false, so anna has the same amount she started with
    await expect(anna).has.an.approxBalanceOf("1000.00", ogn);
    // but the withdraw should be good
    expect(await uniswapPairOUSD_USDT.balanceOf(anna.address)).to.equal(
      depositAmount
    );

    // +1 block for the withdraw
    // after the withdraw there's zero LPTokens so there will be no more reward accrued for the extra block
    const withdrawRewardAmount = rewardPerBlock.mul(11);

    await liquidityRewardOUSD_USDT.connect(anna).claim();
    const expectedOgn = withdrawRewardAmount.add(utils.parseUnits("1000", 18));
    expect(await ogn.balanceOf(anna.address)).to.equal(expectedOgn);
    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
  });

  it("Deposit, withdraw, and claim with multiple accounts", async () => {
    const {
      ogn,
      anna,
      matt,
      josh,
      uniswapPairOUSD_USDT,
      liquidityRewardOUSD_USDT,
    } = fixture;

    await expect(anna).has.an.approxBalanceOf("1000.00", ogn);
    await expect(matt).has.an.approxBalanceOf("1000.00", ogn);
    await expect(josh).has.an.approxBalanceOf("1000.00", ogn);

    const rewardPerBlock = await liquidityRewardOUSD_USDT.rewardPerBlock();

    // mint and deposit the LP token into liquidity reward contract
    const depositAmount = utils.parseUnits("1", 18);
    await uniswapPairOUSD_USDT.connect(anna).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(anna)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(anna).deposit(depositAmount);

    await uniswapPairOUSD_USDT.connect(matt).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(matt)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(matt).deposit(depositAmount);

    await uniswapPairOUSD_USDT.connect(josh).mint(depositAmount);
    await uniswapPairOUSD_USDT
      .connect(josh)
      .approve(liquidityRewardOUSD_USDT.address, depositAmount);
    await liquidityRewardOUSD_USDT.connect(josh).deposit(depositAmount);

    await advanceBlocks(2);

    // there should be 6 blocks so far, 2 for each mint/approve/deposit after the first deposit
    // and 2 for the advance
    expect(
      await liquidityRewardOUSD_USDT.totalOutstandingRewards()
    ).to.approxEqual(rewardPerBlock.mul(8));

    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.approxEqual(
      rewardPerBlock
        .mul(3) // first 3 blocks was anna alone
        .add(rewardPerBlock.mul(3).div(2)) // next 3 was amongst 2
        .add(rewardPerBlock.mul(2).div(3)) // next 2 was amongst 3
    );

    let mattRewards = rewardPerBlock
      .mul(3)
      .div(2) // first 3 matt has to split with ann
      .add(rewardPerBlock.mul(2).div(3));

    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(matt.address)
    ).to.approxEqual(mattRewards);

    await liquidityRewardOUSD_USDT.connect(matt).claim();

    const baseOgn = utils.parseUnits("1000", 18);

    mattRewards = mattRewards.add(rewardPerBlock.div(3)); //since we haven't withdraw, we're entitled to another round on the claim
    expect(await ogn.balanceOf(matt.address)).to.approxEqual(
      mattRewards.add(baseOgn)
    );

    await liquidityRewardOUSD_USDT.connect(matt).withdraw(depositAmount, false);

    expect(await uniswapPairOUSD_USDT.balanceOf(matt.address)).to.approxEqual(
      depositAmount
    );

    // claim twice
    await liquidityRewardOUSD_USDT.connect(matt).claim();
    mattRewards = mattRewards.add(rewardPerBlock.div(3)); //Another block on the claim

    expect(await ogn.balanceOf(matt.address)).to.approxEqual(
      mattRewards.add(baseOgn)
    );

    let annaReward = rewardPerBlock
      .mul(3) // first 2 blocks was anna alone
      .add(rewardPerBlock.mul(3).div(2))
      .add(rewardPerBlock.mul(4).div(3)) // we moved 2 more blocks due to matt's claim/withdraw
      .add(rewardPerBlock.div(2)); // we moved 1 block with matt out of the picture

    expect(
      await liquidityRewardOUSD_USDT.pendingRewards(anna.address)
    ).to.approxEqual(annaReward);

    await liquidityRewardOUSD_USDT.connect(anna).withdraw(depositAmount, true);

    annaReward = annaReward.add(rewardPerBlock.div(2));

    expect(await ogn.balanceOf(anna.address)).to.approxEqual(
      annaReward.add(baseOgn)
    );

    // but the withdraw should be good
    expect(await uniswapPairOUSD_USDT.balanceOf(anna.address)).to.equal(
      depositAmount
    );

    await liquidityRewardOUSD_USDT.connect(josh).withdraw(depositAmount, false);
    await liquidityRewardOUSD_USDT.connect(josh).claim();

    expect(await ogn.balanceOf(josh.address)).to.approxEqual(
      rewardPerBlock
        .mul(4)
        .div(3) // josh started late
        .add(rewardPerBlock.mul(2).div(2)) // for the block where matt withdrew
        .add(rewardPerBlock) // for the last block
        .add(baseOgn)
    );

    expect(await liquidityRewardOUSD_USDT.totalOutstandingRewards()).to.equal(
      "0"
    );
  });
});
