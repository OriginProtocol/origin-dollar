const { expect } = require("chai");

const { loadDefaultFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

describe("Check vault value", () => {
  let vault, ousd, matt, usds, checker, vaultSigner;

  beforeEach(async () => {
    const fixture = await loadDefaultFixture();
    vault = fixture.vault;
    ousd = fixture.ousd;
    matt = fixture.matt;
    usds = fixture.usds;
    checker = await ethers.getContract("VaultValueChecker");
    vaultSigner = await ethers.getSigner(vault.address);
    await impersonateAndFund(vaultSigner.address);
  });

  async function changeAndSnapshot(opts) {
    const vaultChange = opts.vaultChange;
    const supplyChange = opts.supplyChange;

    // Take pre-change snapshot
    await checker.connect(matt).takeSnapshot();

    // Alter value
    if (vaultChange > 0) {
      await usds.mintTo(vault.address, vaultChange);
    } else if (vaultChange < 0) {
      // transfer amount out of the vault
      await usds
        .connect(vaultSigner)
        .transfer(matt.address, vaultChange * -1, { gasPrice: 0 });
    }
    // Alter supply
    await ousd
      .connect(vaultSigner)
      .changeSupply((await ousd.totalSupply()).add(supplyChange), {
        gasPrice: 0,
      });
  }

  function testChange(opts) {
    return async () => {
      const {
        vaultChange,
        expectedProfit,
        profitVariance,
        supplyChange,
        expectedVaultChange,
        vaultChangeVariance,
        expectedRevert,
      } = opts;

      await changeAndSnapshot({ vaultChange, supplyChange });

      // Verify checkDelta behavior
      const fn = checker
        .connect(matt)
        .checkDelta(
          expectedProfit,
          profitVariance,
          expectedVaultChange,
          vaultChangeVariance
        );
      if (expectedRevert) {
        await expect(fn).to.be.revertedWith(expectedRevert);
      } else {
        await fn;
      }
    };
  }

  // ---- Vault value

  it(
    "should succeed if vault gain was inside the allowed band",
    testChange({
      vaultChange: 200,
      expectedProfit: 0,
      profitVariance: 100,
      supplyChange: 200,
      expectedVaultChange: 200,
      vaultChangeVariance: 100,
    })
  );
  it(
    "should revert if vault gain less than allowed",
    testChange({
      vaultChange: 50,
      expectedProfit: 125,
      profitVariance: 25,
      supplyChange: 2,
      expectedVaultChange: 1,
      vaultChangeVariance: 1,
      expectedRevert: "Profit too low",
    })
  );
  it(
    "should revert if vault gain more than allowed",
    testChange({
      vaultChange: 550,
      expectedProfit: 500,
      profitVariance: 50,
      supplyChange: 2,
      expectedVaultChange: 1,
      vaultChangeVariance: 1,
      expectedRevert: "Vault value change too high",
    })
  );
  it(
    "should succeed if vault loss was inside the allowed band",
    testChange({
      vaultChange: -200,
      expectedProfit: -200,
      profitVariance: 100,
      supplyChange: 0,
      expectedVaultChange: -200,
      vaultChangeVariance: 0,
    })
  );
  it(
    "should revert if vault loss under allowed band",
    testChange({
      vaultChange: -400,
      expectedProfit: -400,
      profitVariance: 40,
      supplyChange: 0,
      expectedVaultChange: 0,
      vaultChangeVariance: 100,
      expectedRevert: "Vault value change too low",
    })
  );

  it(
    "should revert if vault loss over allowed band",
    testChange({
      vaultChange: 100,
      expectedProfit: 100,
      profitVariance: 100,
      supplyChange: 0,
      expectedVaultChange: 0,
      vaultChangeVariance: 50,
      expectedRevert: "Vault value change too high",
    })
  );

  // ---- OUSD Supply

  it(
    "should succeed if supply gain was inside the allowed band",
    testChange({
      vaultChange: 0,
      expectedProfit: -80,
      profitVariance: 30,
      supplyChange: 100,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
    })
  );
  it(
    "should revert if supply gain less than allowed",
    testChange({
      vaultChange: 0,
      expectedProfit: -400,
      profitVariance: 100,
      supplyChange: 200,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
      expectedRevert: "Profit too high",
    })
  );
  it(
    "should revert if supply gain more than allowed",
    testChange({
      vaultChange: 0,
      expectedProfit: -200,
      profitVariance: 100,
      supplyChange: 400,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
      expectedRevert: "Profit too low",
    })
  );
  it(
    "should succeed if supply loss was inside the allowed band",
    testChange({
      vaultChange: 0,
      expectedProfit: -300,
      profitVariance: 100,
      supplyChange: 400,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
    })
  );
  it(
    "should revert if supply loss lower than allowed",
    testChange({
      vaultChange: 0,
      expectedProfit: 500,
      profitVariance: 100,
      supplyChange: -800,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
      expectedRevert: "Profit too high",
    })
  );
  it(
    "should revert if supply loss closer to zero than allowed",
    testChange({
      vaultChange: 0,
      expectedProfit: 500,
      profitVariance: 100,
      supplyChange: -200,
      expectedVaultChange: 0,
      vaultChangeVariance: 0,
      expectedRevert: "Profit too low",
    })
  );
});
