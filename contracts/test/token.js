const { expect } = require("chai");
const {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  daiUnits,
  tusdUnits,
  defaultFixture,
} = require("./_fixture");

describe("Token", function () {
  async function expectBalance(contract, user, expected, message) {
    expect(await contract.balanceOf(user.getAddress()), message).to.equal(
      expected
    );
  }

  it("Should return the token name and symbol", async () => {
    const { ousd } = await waffle.loadFixture(defaultFixture);
    expect(await ousd.name()).to.equal("Origin Dollar");
    expect(await ousd.symbol()).to.equal("OUSD");
  });

  it("Should have 18 decimals", async () => {
    const { ousd } = await waffle.loadFixture(defaultFixture);
    expect(await ousd.decimals()).to.equal(18);
  });

  it("Should allow a simple transfer of 1 OUSD", async () => {
    const { ousd, matt, anna } = await waffle.loadFixture(defaultFixture);
    await expectBalance(ousd, matt, ousdUnits("100"));
    await expectBalance(ousd, anna, ousdUnits("0"));
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expectBalance(ousd, anna, ousdUnits("1"));
    await expectBalance(ousd, matt, ousdUnits("99"));
  });

  it("Should allow a transferFrom with an allowance", async () => {
    const { ousd, matt, anna } = await waffle.loadFixture(defaultFixture);

    // Approve OUSD for transferFrom
    await ousd.connect(matt).approve(anna.getAddress(), ousdUnits("100"));
    expect(
      await ousd.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(ousdUnits("100"));

    // Do a transferFrom of OUSD
    await ousd
      .connect(anna)
      .transferFrom(
        await matt.getAddress(),
        await anna.getAddress(),
        ousdUnits("1")
      );

    // Anna should have the dollar
    await expectBalance(ousd, anna, ousdUnits("1"));
  });

  it("Should increase users balance on supply increase", async () => {
    const { ousd, vault, usdt, matt, anna } = await waffle.loadFixture(
      defaultFixture
    );

    // Transfer 1 to Anna, so we can check different amounts
    await ousd.connect(matt).transfer(anna.getAddress(), ousdUnits("1"));
    await expectBalance(ousd, matt, ousdUnits("99"));
    await expectBalance(ousd, anna, ousdUnits("1"));

    // Increase total supply thus increasing all user's balances
    await usdt.connect(matt).approve(vault.address, usdtUnits("2.0"));
    await vault.connect(matt).depositYield(usdt.address, usdtUnits("2.0"));

    // Contract originaly contained $200, now has $202.
    // Matt should have (99/200) * 202 OUSD
    await expectBalance(ousd, matt, ousdUnits("99.99"));
    // Anna should have (1/200) * 202 OUSD
    await expectBalance(ousd, anna, ousdUnits("1.01"));
  });
});
