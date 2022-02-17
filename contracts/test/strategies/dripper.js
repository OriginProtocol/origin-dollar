const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");

const { loadFixture, usdtUnits, advanceTime } = require("../helpers");

describe("Dripper", async () => {
  let dripper, usdt, vault, ousd, governor, josh;
  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    dripper = fixture.dripper;
    usdt = fixture.usdt;
    vault = fixture.vault;
    ousd = fixture.ousd;
    governor = fixture.governor;
    josh = fixture.josh;

    await usdt.mintTo(dripper.address, usdtUnits("1000"));
  });

  async function emptyDripper() {
    const balance = await usdt.balanceOf(dripper.address);
    await dripper.connect(governor).transferToken(usdt.address, balance);
  }

  async function expectApproxCollectOf(amount, fn) {
    const before = await usdt.balanceOf(vault.address);
    await fn();
    const after = await usdt.balanceOf(vault.address);
    const collected = after.sub(before);
    expect(collected).gte(usdtUnits(amount).mul(998).div(1000));
    expect(collected).lte(usdtUnits(amount).mul(1002).div(1000));
  }

  describe("availableFunds()", async () => {
    it("shows zero available before any duration has been set", async () => {
      await advanceTime(1000);
      expect(await dripper.availableFunds()).to.equal(0);
    });
    it("returns a number after a duration has been set", async () => {
      await dripper.connect(governor).setDripDuration("2000");
      await advanceTime(1000);
      expect(await dripper.availableFunds()).to.equal(usdtUnits("500"));
    });
    it("returns zero if no balance", async () => {
      await dripper.connect(governor).setDripDuration("2000");
      await advanceTime(1000);
      await emptyDripper();
      expect(await dripper.availableFunds()).to.equal(usdtUnits("0"));
    });
  });
  describe("collect()", async () => {
    it("transfers funds to the vault", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(1000);
      await expectApproxCollectOf("50", dripper.collect);
    });
    it("collects what is reported by availableFunds()", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(17890);
      const expected = ((await dripper.availableFunds()) / 1e6).toString();
      await expectApproxCollectOf(expected, dripper.collect);
    });
  });
  describe("collectAndRebase()", async () => {
    it("transfers funds to the vault and rebases", async () => {
      const beforeRct = await ousd.rebasingCreditsPerToken();
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(1000);
      await expectApproxCollectOf("50", dripper.collectAndRebase);
      const afterRct = await ousd.rebasingCreditsPerToken();
      expect(afterRct).to.be.lt(beforeRct);
    });
  });
  describe("Drip math", async () => {
    it("gives all funds if collect is after the duration end", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(20001);
      await expectApproxCollectOf("1000", dripper.collect);
    });
    it("gives 98% of funds if the collect is 98% to the duration", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await advanceTime(19600);
      await expectApproxCollectOf("980", dripper.collect);
    });
    it("adding funds does not change the current drip rate", async () => {
      await dripper.connect(governor).setDripDuration("20000");
      await usdt.mintTo(dripper.address, usdtUnits("3000"));
      await advanceTime(19600);
      await expectApproxCollectOf("980", dripper.collect);
    });
    it("rounds down the rate", async () => {
      await emptyDripper();
      await usdt.mintTo(dripper.address, 999); // 1/1000 of a USDC
      await dripper.connect(governor).setDripDuration("1000");
      await advanceTime(500);
      // Per block rate should be zero
      await expectApproxCollectOf("0", dripper.collect);
    });
  });
  describe("collectTokens()", async () => {
    it("transfers funds to governor", async () => {
      await expect(governor).to.have.balanceOf("1000", usdt);
      await expect(dripper).to.have.balanceOf("1000", usdt);
      const balance = usdt.balanceOf(dripper.address);
      await dripper.connect(governor).transferToken(usdt.address, balance);
      await expect(dripper).to.have.balanceOf("0", usdt);
      await expect(governor).to.have.balanceOf("2000", usdt);
    });
    it("cannot be called by the public", async () => {
      await expect(dripper.connect(josh).transferToken(usdt.address, 1)).to.be
        .reverted;
    });
  });
  describe("setDripDuration()", async () => {
    it("transfers funds to governor", async () => {
      await dripper.connect(governor).setDripDuration(1000);
      expect(await dripper.dripDuration()).to.equal(1000);
    });
    it("cannot be called by the public", async () => {
      await expect(dripper.connect(josh).setDripDuration(1000)).to.be.reverted;
    });
    it("cannot be set to zero by the public", async () => {
      await expect(
        dripper.connect(governor).setDripDuration(0)
      ).to.be.revertedWith("duration must be non-zero");
    });
  });
});
