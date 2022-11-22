const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe.only("Check vault value", () => {
  let vault, ousd, matt, dai, checker, vaultSigner;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    vault = fixture.vault;
    ousd = fixture.vault;
    matt = fixture.matt;
    dai = fixture.dai;
    checker = await ethers.getContract("VaultValueChecker");
    vaultSigner = await ethers.getSigner(vault.address);
  });

  async function changeAndSnapshot(opts) {
    const valueDelta = opts.valueDelta;
    const supplyDelta = opts.supplyDelta;

    // // Alter value
    // if(valueDelta > 0){
    //   await dai.mintTo(valueDelta, vault.address)
    // } else {
    //   await dai.connect(vaultSigner).transfer(matt, valueDelta * -1)
    // }
    // // Alter supply
    // await ousd.connect(vaultSigner).changeSupply(await ousd.totalSupply() + supplyDelta)

    await checker.takeSnapshot();
  }

  function testChange(opts) {
    return async () => {
      const {
        valueDelta,
        valueMin,
        valueMax,
        supplyDelta,
        supplyMin,
        supplyMax,
        expectedRevert,
      } = opts;

      await changeAndSnapshot({ valueDelta, supplyDelta });

      // Verify checkLoss behavior
      if (expectedRevert) {
        await expect(
          checker.checkDelta(valueMin, valueMax, supplyMin, supplyMax)
        ).to.be.revertedWith(expectedRevert);
      } else {
        await checker.checkDelta(valueMin, valueMax, supplyMin, supplyMax);
      }
    };
  }

  // ---- Vault value

  it(
    "should succeed if vault gain was inside the allowed band",
    testChange({
      valueDelta: 200,
      valueMin: 100,
      valueMax: 300,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
    })
  );
  it(
    "should revert if vault gain less than allowed",
    testChange({
      valueDelta: 50,
      valueMin: 100,
      valueMax: 150,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
      expectedRevert: "Vault value too low",
    })
  );
  it(
    "should revert if vault gain more than allowed",
    testChange({
      valueDelta: 550,
      valueMin: 200,
      valueMax: 350,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
      expectedRevert: "Vault value too high",
    })
  );
  it(
    "should succeed if vault loss was inside the allowed band",
    testChange({
      valueDelta: -200,
      valueMin: -100,
      valueMax: -300,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
    })
  );
  it(
    "should revert if vault loss less than allowed",
    testChange({
      valueDelta: -40,
      valueMin: -100,
      valueMax: -20,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
      expectedRevert: "Vault value too low",
    })
  );
  it(
    "should revert if vault loss more than allowed",
    testChange({
      valueDelta: -550,
      valueMin: -400,
      valueMax: -150,
      supplyDelta: 1,
      supplyMin: 0,
      supplyMax: 1,
      expectedRevert: "Vault value too high",
    })
  );

  // ---- OUSD Supply

  it(
    "should succeed if supply gain was inside the allowed band",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: 200,
      supplyMin: 100,
      supplyMax: 300,
    })
  );
  it(
    "should revert if supply gain less than allowed",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: 50,
      supplyMin: 100,
      supplyMax: 150,
      expectedRevert: "OUSD supply too low",
    })
  );
  it(
    "should revert if supply gain more than allowed",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: 550,
      supplyMin: 200,
      supplyMax: 350,
      expectedRevert: "OUSD supply too high",
    })
  );
  it(
    "should succeed if supply loss was inside the allowed band",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: -200,
      supplyMin: -100,
      supplyMax: -300,
    })
  );
  it(
    "should revert if supply loss less than allowed",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: -40,
      supplyMin: -100,
      supplyMax: -20,
      expectedRevert: "OUSD supply too low",
    })
  );
  it(
    "should revert if supply loss more than allowed",
    testChange({
      valueDelta: 0,
      valueMin: 0,
      valueMax: 0,
      supplyDelta: -550,
      supplyMin: -400,
      supplyMax: -150,
      expectedRevert: "OUSD supply too high",
    })
  );
});
