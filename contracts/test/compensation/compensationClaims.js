const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const parseUnits = utils.parseUnits;
const {
  ousdUnits,
  advanceTime,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

const day = 24 * 60 * 60;
const year = 360 * day;

// const { ogn, anna, governor, ognStaking } = await loadFixture(
//     defaultFixture
//   );

describe("Compensation Claims", async () => {
  if (isGanacheFork) {
    this.timeout(0);
  }
  const expectTotalClaims = async (compensationClaims, amount) => {
    expect(await compensationClaims.totalClaims()).to.equal(
      ousdUnits(amount),
      "Totals"
    );
  };

  describe("User claims", async () => {
    let governor, adjuster, matt, josh, anna, ousd, compensationClaims;

    beforeEach(async () => {
      const fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      josh = fixture.josh;
      anna = fixture.anna;
      compensationClaims = fixture.compensationClaims;
    });
    it("should show a user their funds, and a total of all funds", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await expect(anna).to.have.a.balanceOf("20", compensationClaims);
      await expectTotalClaims(compensationClaims, "20");
    });
    it("should show a zero for a user without a claim", async () => {
      await expect(josh).to.have.a.balanceOf("0", compensationClaims);
    });
    it(
      "should not allow a user to withdraw their funds before the claim period"
    );
    it(
      "should allow a user to withdraw their funds after the start of the claim period"
    );
    it(
      "should allow a user to withdraw their funds just before the end of the claim period"
    );
    it(
      "should not allow a user to withdraw their funds after the claim period"
    );
    it("should throw if the user never had a claim");
    it("should throw if the user has already claimed their funds");
  });

  describe("Adjuster", async () => {
    let governor, adjuster, matt, josh, anna, ousd, compensationClaims;

    beforeEach(async () => {
      const fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      josh = fixture.josh;
      anna = fixture.anna;
      compensationClaims = fixture.compensationClaims;
    });

    it("should set one claim amount", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await expect(anna).to.have.a.balanceOf("20", compensationClaims);
      await expectTotalClaims(compensationClaims, "20");
    });
    it("should set multiple claim amounts", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amounts = [ousdUnits("40.0023"), ousdUnits("0.000091")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await expect(anna).to.have.a.balanceOf("40.0023", compensationClaims);
      await expect(matt).to.have.a.balanceOf("0.000091", compensationClaims);
      await expectTotalClaims(compensationClaims, "40.002391");
    });
    it("should be able to set same account twice, and have the totals be correct", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amountsOne = [ousdUnits("40.0023"), ousdUnits("0.000091")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims
        .connect(adjuster)
        .setClaims(accounts, amountsOne);
      const amountsTwo = [ousdUnits("1.000091"), ousdUnits("4000000.00")];
      await compensationClaims
        .connect(adjuster)
        .setClaims(accounts, amountsTwo);

      await expect(anna).to.have.a.balanceOf("1.000091", compensationClaims);
      await expect(matt).to.have.a.balanceOf("4000000.00", compensationClaims);
      await expectTotalClaims(compensationClaims, "4000001.000091");
    });
    it("should not be able to overflow the total amount", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amounts = [parseUnits("1.1", 77), parseUnits("1", 77)];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("SafeMath: addition overflow");
    });
    it("should not be able to set mismatching addresses and amounts", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20"), ousdUnits("40")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("addresses and amounts must match");
    });

    it("should not be able to set claims before being unlocked", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Adjuster must be unlocked");
    });
    it("should not be able to set claims after being locked", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(governor).lockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Adjuster must be unlocked");
    });
    it("should not be able to set claims during the claim period", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(governor).start(100);
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Should not be in claim period");
    });
    it("no one else should be able to set one claim amount", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [ousdUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(anna).setClaims(accounts, amounts)
      ).to.be.revertedWith("Must be adjuster");
    });
  });

  describe("Admin", async () => {
    let governor, adjuster, matt, josh, anna, ousd, compensationClaims;
    beforeEach(async () => {
      const fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      josh = fixture.josh;
      anna = fixture.anna;
      compensationClaims = fixture.compensationClaims;
    });

    it("should be able to unlock adjuster", async () => {
      await compensationClaims.connect(governor).unlockAdjuster();
      expect(await compensationClaims.isAdjusterLocked()).to.be.false;
    });
    it("should be able to lock adjuster", async () => {
      await compensationClaims.connect(governor).lockAdjuster();
      expect(await compensationClaims.isAdjusterLocked()).to.be.true;
    });
    it("should not be able to unlock adjuster during claims period", async () => {
      await compensationClaims.connect(governor).start(1000);
      await expect(compensationClaims.connect(governor).unlockAdjuster()).to.be
        .reverted;
    });
    it("should not be able to lock adjuster during claims period", async () => {
      await compensationClaims.connect(governor).start(1000);
      await expect(compensationClaims.connect(governor).lockAdjuster()).to.be
        .reverted;
    });
    it("no one else unlock adjustor", async () => {
      await expect(compensationClaims.connect(anna).unlockAdjuster()).to.be
        .reverted;
    });
    it("no one else lock adjustor", async () => {
      await expect(compensationClaims.connect(anna).lockAdjuster()).to.be
        .reverted;
    });

    it("should be able to start a claims period", async () => {
      await compensationClaims.connect(governor).start(1000);
    });
    it("should not be able to start a claims period with insufficient funds");
    it(
      "should not be able to start a claims period if a claim period is running"
    );
    it("should not be able to start a claims period if adjuster is unlocked");
    it(
      "should not be able to start a claims period if end time is too far in the future"
    );
    it("should not be able to start a claims period if end time is in past");
    it("no one else can start");

    it("should be able to collect before claims period");
    it("should be able to collect after claims period");
    it("should not be able to collect during claims period");
    it("no one else can collect");
  });
});
