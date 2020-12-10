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

const signedPayouts = require("../../scripts/staking/airDroppedTestPayouts.json");

describe("Airdropped Staking", function () {
  if (isGanacheFork) {
    this.timeout(0);
  }

  it("Can stake a signed entry", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const payoutEntry = signedPayouts[anna.address];

    await ognStaking
      .connect(anna)
      .airDroppedStake(
        payoutEntry.index,
        payoutEntry.type,
        payoutEntry.duration,
        payoutEntry.rate,
        payoutEntry.amount,
        payoutEntry.proof
      );

    const amount = BigNumber.from(payoutEntry.amount);
    const expectedReward = amount
      .mul(payoutEntry.rate)
      .div("1000000000000000000");

    expect(await ognStaking.totalOutstanding()).to.equal(
      amount.add(expectedReward)
    );

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount
    );

    await advanceTime(year / 2);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount.add(expectedReward.div(2))
    );

    await expect(ognStaking.connect(anna).exit()).to.be.revertedWith(
      "All stakes in lock-up"
    );

    await advanceTime(year / 2);

    expect(await ognStaking.totalCurrentHoldings(anna.address)).to.equal(
      amount.add(expectedReward)
    );

    expect(await ogn.balanceOf(anna.address)).to.equal(annaStartBalance);

    await ognStaking.connect(anna).exit();

    expect(await ogn.balanceOf(anna.address)).to.equal(
      annaStartBalance.add(amount).add(expectedReward)
    );
  });

  it("Can stake multiple signed entries", async () => {
    const { ogn, anna, josh, matt, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);
    let totalAmount = BigNumber.from(0);

    for (const user of [matt, josh, anna]) {
      const payoutEntry = signedPayouts[user.address];

      await ognStaking
        .connect(user)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          payoutEntry.amount,
          payoutEntry.proof
        );
      const expectedReward = BigNumber.from(payoutEntry.amount)
        .mul(payoutEntry.rate)
        .div("1000000000000000000");
      totalAmount = totalAmount.add(payoutEntry.amount).add(expectedReward);
    }

    expect(await ognStaking.totalOutstanding()).to.equal(totalAmount);
  });

  it("Invalid proof not allowed", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const payoutEntry = signedPayouts[anna.address];

    // changes in the params should not be allowed
    //
    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          BigNumber.from(payoutEntry.amount).add(1),
          [...payoutEntry.proof, payoutEntry.proof[0]]
        )
    ).to.be.revertedWith("Invalid proof");
  });

  it("Invalid and double staking not allowed", async () => {
    const { ogn, anna, governor, ognStaking } = await loadFixture(
      defaultFixture
    );

    const annaStartBalance = await ogn.balanceOf(anna.address);

    const payoutEntry = signedPayouts[anna.address];

    // invalid index one that's to high
    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          4,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          BigNumber.from(payoutEntry.amount).add(1),
          payoutEntry.proof
        )
    ).to.be.revertedWith("Invalid index");

    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          3,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          BigNumber.from(payoutEntry.amount).add(1),
          payoutEntry.proof
        )
    ).to.be.revertedWith("Stake not approved");

    // changes in the params should not be allowed
    //
    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          BigNumber.from(payoutEntry.amount).add(1),
          payoutEntry.proof
        )
    ).to.be.revertedWith("Stake not approved");
    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          payoutEntry.duration,
          BigNumber.from(payoutEntry.rate).add(1),
          payoutEntry.amount,
          payoutEntry.proof
        )
    ).to.be.revertedWith("Stake not approved");
    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          BigNumber.from(payoutEntry.duration).sub(1),
          payoutEntry.rate,
          payoutEntry.amount,
          payoutEntry.proof
        )
    ).to.be.revertedWith("Stake not approved");

    await ognStaking
      .connect(anna)
      .airDroppedStake(
        payoutEntry.index,
        payoutEntry.type,
        payoutEntry.duration,
        payoutEntry.rate,
        payoutEntry.amount,
        payoutEntry.proof
      );

    await expect(
      ognStaking
        .connect(anna)
        .airDroppedStake(
          payoutEntry.index,
          payoutEntry.type,
          payoutEntry.duration,
          payoutEntry.rate,
          payoutEntry.amount,
          payoutEntry.proof
        )
    ).to.be.revertedWith("Already staked");
  });
});
