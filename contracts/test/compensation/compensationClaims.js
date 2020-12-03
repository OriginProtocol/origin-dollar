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


// const { ogn, anna, governor, ognStaking } = await loadFixture(
//     defaultFixture
//   );

describe("Compensation Claims", async() => {
    if (isGanacheFork) {
      this.timeout(0);
    }
    
    describe("User claims", async ()=> {
        it("should show a user their funds")
        it("should show total of all funds")
        it("should not allow a user to withdraw their funds before the claim period")
        it("should allow a user to withdraw their funds after the start of the claim period")
        it("should allow a user to withdraw their funds just before the end of the claim period")
        it("should not allow a user to withdraw their funds after the claim period")
        it("should throw if the user never had a claim")
        it("should throw if the user has already claimed their funds")
    })

    describe("Adjuster", async ()=> {
        it("should set one claim amount")
        it("should set multiple claim amounts")
        it("should not be able to overflow the total amount")
        it("should not be able to set mismatching addresses and amounts")

        it("should not be able to set claims before being unlocked")
        it("should not be able to set claims after being locked")
        it("should not be able to set claims during the claim period")
    })

    describe("Admin", async ()=> {
        it("should be able to unlock adjuster")
        it("should be able to lock adjuster")
        it("should not be able to unlock adjuster during claims period")
        it("should not be able to lock adjuster during claims period")

        it("should be able to start a claims period")
        it("should not be able to start a claims period with insufficient funds")
        it("should not be able to start a claims period if a claim period is running")
        it("should not be able to start a claims period if adjuster is unlocked")
        it("should not be able to start a claims period if end time is too far in the future")
        it("should not be able to start a claims period if end time is in past")

        it("should be able to collect before claims period")
        it("should be able to collect after claims period")
        it("should not be able to collect during claims period")
    })
})

    
      