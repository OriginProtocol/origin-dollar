const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const {
  ognUnits,
  advanceTime,
  loadFixture,
  expectApproxSupply,
  isGanacheFork,
} = require("../helpers");

const day = 24 * 60 * 60;
const year = 360 * day;

const signedPayouts = require("../../scripts/staking/signedTestPayouts.json");


describe("Preapproved Staking", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Can stake a signed entry", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const payoutEntry = signedPayouts[anna.address];

    const expandedSig = utils.splitSignature(payoutEntry.signature);

    await ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
      payoutEntry.duration, payoutEntry.rate, payoutEntry.amount, 
      expandedSig.v, expandedSig.r, expandedSig.s);

    const amount = BigNumber.from(payoutEntry.amount);
    const expectedReward = amount.mul(payoutEntry.rate).div("1000000000000000000");

    expect(await ognStaking.totalOutstanding()).to.equal(
      amount.add(expectedReward)
    );

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount
    );

    await advanceTime( year/2 );

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount.add(expectedReward.div(2))
    );

    await expect(
      ognStaking.connect(anna).exit()
    ).to.be.revertedWith("All stakes in lock-up");

    await advanceTime( year/2 );

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount.add(expectedReward)
    );

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance
    );

    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance.add(amount).add(expectedReward)
    );
  });


  it("Invalid and double staking not allowed", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const payoutEntry = signedPayouts[anna.address];

    const expandedSig = utils.splitSignature(payoutEntry.signature);
    // changes in the params should not be allowed
    //
    await expect( 
      ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
        payoutEntry.duration, payoutEntry.rate, BigNumber.from(payoutEntry.amount).add(1), 
        expandedSig.v, expandedSig.r, expandedSig.s) 
    ).to.be.revertedWith("Stake not approved");
    await expect( 
      ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
        payoutEntry.duration, BigNumber.from(payoutEntry.rate).add(1), payoutEntry.amount, 
        expandedSig.v, expandedSig.r, expandedSig.s) 
    ).to.be.revertedWith("Stake not approved");
    await expect( 
      ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
        BigNumber.from(payoutEntry.duration).sub(1), payoutEntry.rate, payoutEntry.amount, 
        expandedSig.v, expandedSig.r, expandedSig.s) 
    ).to.be.revertedWith("Stake not approved");

    await ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
      payoutEntry.duration, payoutEntry.rate, payoutEntry.amount, 
      expandedSig.v, expandedSig.r, expandedSig.s);

    await expect( 
      ognStaking.connect(anna).preApprovedStake(payoutEntry.type,
        payoutEntry.duration, payoutEntry.rate, payoutEntry.amount, 
        expandedSig.v, expandedSig.r, expandedSig.s) 
    ).to.be.revertedWith("Already staked");
  });

});
