const { expect } = require("chai");
const { defaultFixture, impersonateAccount } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe("Check vault value", () => {
  let vault, ousd, matt, dai, checker, vaultSigner;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    ousd = fixture.ousd;
    matt = fixture.matt;
    dai = fixture.dai;
    checker = await ethers.getContract("VaultValueChecker");
    vaultSigner = await ethers.getSigner(vault.address);
    await impersonateAccount(vaultSigner.address);
  });

  async function changeAndSnapshot(opts) {
    const valueDelta = opts.valueDelta;
    const supplyDelta = opts.supplyDelta;

    // Take pre-change snapshot
    await checker.connect(matt).takeSnapshot();

    // Alter value
    if(valueDelta > 0){
      await dai.mintTo(vault.address, valueDelta)
    } else {
      await dai.connect(vaultSigner).transfer(matt.address, valueDelta * -1, {'gasPrice':0})
    }
    // Alter supply
    await ousd.connect(vaultSigner).changeSupply((await ousd.totalSupply()).add(supplyDelta), {'gasPrice':0})
  }

  function testChange(opts) {
    return async () => {
      const {
        valueDelta,
        valueLow,
        valueHigh,
        supplyDelta,
        supplyLow,
        supplyHigh,
        expectedRevert,
      } = opts;

      await changeAndSnapshot({ valueDelta, supplyDelta });

      // Verify checkDelta behavior
      const fn = checker.connect(matt).checkDelta(valueLow, valueHigh, supplyLow, supplyHigh)
      if (expectedRevert) {

        await expect(fn).to.be.revertedWith(expectedRevert);
      } else {
        await fn
      }
    };
  }

  // ---- Vault value

  it(
    "should succeed if vault gain was inside the allowed band",
    testChange({
      valueDelta: 200,
      valueLow: 100,
      valueHigh: 300,
      supplyDelta: 200,
      supplyLow: 0,
      supplyHigh: 400,
    })
  );
  it(
    "should revert if vault gain less than allowed",
    testChange({
      valueDelta: 50,
      valueLow: 100,
      valueHigh: 150,
      supplyDelta: 1,
      supplyLow: 0,
      supplyHigh: 1,
      expectedRevert: "Vault value too low",
    })
  );
  it(
    "should revert if vault gain more than allowed",
    testChange({
      valueDelta: 550,
      valueLow: 200,
      valueHigh: 350,
      supplyDelta: 1,
      supplyLow: 0,
      supplyHigh: 1,
      expectedRevert: "Vault value too high",
    })
  );
  it(
    "should succeed if vault loss was inside the allowed band",
    testChange({
      valueDelta: -200,
      valueLow: -300,
      valueHigh: -100,
      supplyDelta: 0,
      supplyLow: 0,
      supplyHigh: 0,
    })
  );
  it(
    "should revert if vault loss under allowed band",
    testChange({
      valueDelta: -400,
      valueLow: -100,
      valueHigh: -20,
      supplyDelta: 1,
      supplyLow: 0,
      supplyHigh: 1,
      expectedRevert: "Vault value too low",
    })
  );
  it(
    "should revert if vault loss over allowed band",
    testChange({
      valueDelta: -100,
      valueLow: -400,
      valueHigh: -150,
      supplyDelta: 1,
      supplyLow: 0,
      supplyHigh: 1,
      expectedRevert: "Vault value too high",
    })
  );

  // ---- OUSD Supply

  it(
    "should succeed if supply gain was inside the allowed band",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: 200,
      supplyLow: 100,
      supplyHigh: 300,
    })
  );
  it(
    "should revert if supply gain less than allowed",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: 200,
      supplyLow: 800,
      supplyHigh: 10000,
      expectedRevert: "OUSD supply too low",
    })
  );
  it(
    "should revert if supply gain more than allowed",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: 600,
      supplyLow: 100,
      supplyHigh: 300,
      expectedRevert: "OUSD supply too high",
    })
  );
  it(
    "should succeed if supply loss was inside the allowed band",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: -400,
      supplyLow: -500,
      supplyHigh: -100,
    })
  );
  it(
    "should revert if supply loss lower than allowed",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: -800,
      supplyLow: -400,
      supplyHigh: -200,
      expectedRevert: "OUSD supply too low",
    })
  );
  it(
    "should revert if supply loss closer to zero than allowed",
    testChange({
      valueDelta: 0,
      valueLow: 0,
      valueHigh: 0,
      supplyDelta: -200,
      supplyLow: -600,
      supplyHigh: -400,
      expectedRevert: "OUSD supply too high",
    })
  );
});
