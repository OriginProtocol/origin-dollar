const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");
const {
  ognUnits,
  advanceTime,
  loadFixture,
  isFork,
} = require("../helpers");

const day = 24 * 60 * 60;
const threeMonth = 90 * day;
const halfYear = 180 * day;
const year = 360 * day;

describe("Single Asset Staking", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Staking can be paused and unpaused appropriately", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    expect(await ognStaking.paused()).to.equal(false);

    const stakeAmount = ognUnits("1");

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    // should allow staking since it's unpased
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    await expect(ognStaking.connect(anna).setPaused(true)).to.be.revertedWith(
      "Caller is not the Governor"
    );

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);

    // allow paused by governor and disabled staking
    await ognStaking.connect(governor).setPaused(true);
    await expect(
      ognStaking.connect(anna).stake(ognUnits("1"), threeMonth)
    ).to.be.revertedWith("Staking paused");

    await ognStaking.connect(governor).setPaused(false);

    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);
  });

  it("Invalid durations not allowed", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );
    const stakeAmount = ognUnits("1");
    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);

    await expect(
      ognStaking.connect(anna).stake(stakeAmount, 3 * day)
    ).to.be.revertedWith("Invalid duration");
  });

  it("Stake then exit for three months with correct rewards", async () => {
    const { ogn, anna, ognStaking } = await loadFixture(defaultFixture);

    const annaStartBalance = await ogn.balanceOf(anna.address);

    // make sure default rewardRate is set
    expect(await ognStaking.durationRewardRate(threeMonth)).to.equal(
      utils.parseUnits("0.085", 18)
    );

    const numStakeAmount = 1;
    const stakeAmount = ognUnits(numStakeAmount.toString());
    // 0.085 is the default reward for three months
    const expectedReward = ognUnits((numStakeAmount * 0.085).toString());

    // no one is owed anything yet
    expect(await ognStaking.totalOutstanding()).to.equal("0");

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    // we owe the staked and reward to the staker
    expect(await ognStaking.totalOutstanding()).to.equal(
      stakeAmount.add(expectedReward)
    );

    expect(await ognStaking.totalExpectedRewards(anna.address)).to.equal(
      expectedReward
    );

    expect(await ognStaking.totalStaked(anna.address)).to.equal(stakeAmount);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      stakeAmount
    );

    // move forward one and a half month
    await advanceTime(45 * day);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.approxEqual(
      stakeAmount.add(expectedReward.div(2))
    );

    await expect(ognStaking.connect(anna).exit()).to.be.revertedWith(
      "All stakes in lock-up"
    );

    // move to the actual expire time
    await advanceTime(45 * day);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      stakeAmount.add(expectedReward)
    );

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance.sub(stakeAmount)
    );

    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance.add(expectedReward)
    );
  });

  it("Multiple stakes with overlapping time periods", async () => {
    const { ogn, anna, ognStaking } = await loadFixture(defaultFixture);

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const numStakeAmount = 1;
    const stakeAmount = ognUnits(numStakeAmount.toString());
    // 0.05 is the default reward
    const expectedThreeMonthReward = ognUnits(
      (numStakeAmount * 0.085).toString()
    );
    const expectedHalfYearReward = ognUnits(
      (numStakeAmount * 0.145).toString()
    );
    const expectedYearReward = ognUnits((numStakeAmount * 0.3).toString());

    // no one is owed anything yet
    expect(await ognStaking.totalOutstanding()).to.equal("0");

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, year);

    // we owe the staked and reward to the staker
    expect(await ognStaking.totalOutstanding()).to.equal(
      stakeAmount.add(expectedYearReward)
    );

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      stakeAmount
    );

    // move forward one month
    await advanceTime(30 * day);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.approxEqual(
      stakeAmount.add(expectedYearReward.mul(30 * day).div(year))
    );

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    expect(await ognStaking.totalOutstanding()).to.equal(
      stakeAmount.mul(2).add(expectedYearReward).add(expectedThreeMonthReward)
    );

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, halfYear);

    expect(await ognStaking.totalOutstanding()).to.equal(
      stakeAmount
        .mul(3)
        .add(expectedYearReward)
        .add(expectedThreeMonthReward)
        .add(expectedHalfYearReward)
    );

    await advanceTime(30 * day);

    //make sure our math matches
    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.approxEqual(
      stakeAmount
        .mul(3)
        .add(expectedYearReward.mul(60 * day).div(year))
        .add(expectedThreeMonthReward.mul(30 * day).div(threeMonth))
        .add(expectedHalfYearReward.mul(30 * day).div(halfYear))
    );

    // advance 2 months, we should be able to exit the three month
    await advanceTime(60 * day);

    await ognStaking.connect(anna).exit();

    const allStakes = await ognStaking.getAllStakes(anna.address);

    expect(allStakes.length).to.equal(3);

    //we should still have the half year and year locked up
    expect(await ognStaking.totalStaked(anna.address)).to.equal(
      stakeAmount.mul(2)
    );

    // we should get back one of the staked amount and
    // the three month reward
    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance.sub(stakeAmount.mul(2)).add(expectedThreeMonthReward)
    );

    await expect(ognStaking.connect(anna).exit()).to.be.revertedWith(
      "All stakes in lock-up"
    );

    //we went longer than we have to
    await advanceTime(year);

    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance
        .add(expectedThreeMonthReward)
        .add(expectedHalfYearReward)
        .add(expectedYearReward)
    );

    expect(await ognStaking.totalOutstanding()).to.equal("0");
  });

  it("Change rates does not effect existing stake", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    // make sure default rewardRate is set
    expect(await ognStaking.durationRewardRate(threeMonth)).to.equal(
      utils.parseUnits("0.085", 18)
    );

    const numStakeAmount = 1;
    const stakeAmount = ognUnits(numStakeAmount.toString());
    // 0.05 is the default reward
    const expectedReward = ognUnits((numStakeAmount * 0.085).toString());

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    const durations = [90 * day, 180 * day, 360 * day];
    const newRates = [
      utils.parseUnits("0.07", 18),
      utils.parseUnits("0.145", 18),
      utils.parseUnits("0.30", 18),
    ];

    await expect(
      ognStaking.connect(anna).setDurationRates(durations, newRates)
    ).to.be.revertedWith("Caller is not the Governor");

    await expect(
      ognStaking.connect(governor).setDurationRates([], newRates)
    ).to.be.revertedWith("Mismatch durations and rates");

    await ognStaking.connect(governor).setDurationRates(durations, newRates);
    const newExpectedReward = ognUnits((numStakeAmount * 0.07).toString());

    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    await advanceTime(threeMonth);

    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.approxEqual(
      annaStartBalance.add(expectedReward).add(newExpectedReward)
    );
  });

  it("Don't allow stake if we can't pay it off", async () => {
    const { ogn, anna, ognStaking } = await loadFixture(defaultFixture);

    const stakeAmount = ognUnits("1000");
    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    // 30% of 1000 is 300 and we only have 299 ogn in the contract
    await expect(
      ognStaking.connect(anna).stake(stakeAmount, year)
    ).to.be.revertedWith("Insufficient rewards");
  });

  it("Stake then exit and then stake again", async () => {
    const { ogn, anna, ognStaking } = await loadFixture(defaultFixture);

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const numStakeAmount = 1;
    const stakeAmount = ognUnits(numStakeAmount.toString());

    const expectedThreeMonthReward = ognUnits(
      (numStakeAmount * 0.085).toString()
    );
    const expectedHalfYearReward = ognUnits(
      (numStakeAmount * 0.145).toString()
    );

    // Stake for 180 days
    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, halfYear);

    // Advance by 70 days and stake for 90 days
    await advanceTime(70 * day);
    await ogn.connect(anna).approve(ognStaking.address, stakeAmount);
    await ognStaking.connect(anna).stake(stakeAmount, threeMonth);

    // Advance by 95 days and exit
    await advanceTime(95 * day);
    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.approxEqual(
      annaStartBalance.add(expectedThreeMonthReward).sub(stakeAmount)
    );

    // Advance by 30 days and then try to exit
    await advanceTime(30 * day);
    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.approxEqual(
      annaStartBalance.add(expectedThreeMonthReward).add(expectedHalfYearReward)
    );
  });
});
