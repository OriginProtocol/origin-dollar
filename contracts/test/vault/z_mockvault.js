const { expect } = require("chai");
const { utils } = require("ethers");

const { createFixtureLoader, mockVaultFixture } = require("../_fixture");

describe("Vault mock with rebase", async () => {
  let mockVault, matt, ousd, josh, governor;
  beforeEach(async () => {
    const loadFixture = createFixtureLoader(mockVaultFixture);
    const fixture = await loadFixture(mockVaultFixture);
    mockVault = fixture.mockVault;
    matt = fixture.matt;
    ousd = fixture.ousd;
    josh = fixture.josh;
    governor = fixture.governor;

    // Allow a 10% diff
    await mockVault
      .connect(governor)
      .setMaxSupplyDiff(utils.parseUnits("1", 17));
  });

  it("Should increase users balance on rebase after increased Vault value", async () => {
    // Total OUSD supply is 200, mock an increase
    await mockVault.setTotalValue(utils.parseUnits("202", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("101.00", ousd);
    await expect(josh).has.an.approxBalanceOf("101.00", ousd);
  });

  it("Should not decrease users balance on rebase after decreased Vault value", async () => {
    // Total OUSD supply is 200, mock a decrease
    await mockVault.setTotalValue(utils.parseUnits("180", 18));
    await mockVault.rebase();
    await expect(matt).has.an.approxBalanceOf("100.00", ousd);
    await expect(josh).has.an.approxBalanceOf("100.00", ousd);
  });

  // The circuit breaker in `_postRedeem` now bounds the backing ratio
  // (grossAssets / effectiveSupply) within maxSupplyDiff of 1.0. Effective
  // supply here is 200 (matt + josh each hold 100); a request moves supply into
  // the queue but leaves effective supply unchanged, so ratio = grossValue / 200.
  const testSupplyDiff = async ({ grossValue, revertMessage = false }) => {
    await mockVault.setTotalValue(utils.parseUnits(`${grossValue}`, 18));
    const promise = expect(
      mockVault.connect(matt).requestWithdrawal(utils.parseUnits("100", 18))
    );

    if (revertMessage) {
      await promise.to.be.revertedWith(revertMessage);
    } else {
      await promise.to.not.be.reverted;
    }
  };

  it("Should revert when backing ratio far exceeds 1 (eg over-reporting)", async () => {
    // 240 / 200 = 1.2 -> 20% over, beyond the 10% band
    await testSupplyDiff({
      grossValue: 240,
      revertMessage: "Backing ratio out of range",
    });
  });

  it("Should revert when backing ratio far below 1 (large loss)", async () => {
    // 160 / 200 = 0.8 -> 20% under, beyond the 10% band
    await testSupplyDiff({
      grossValue: 160,
      revertMessage: "Backing ratio out of range",
    });
  });

  it("Should pass when backing ratio above 1 but within limits", async () => {
    // 218 / 200 = 1.09 -> 9% over, within the 10% band
    await testSupplyDiff({ grossValue: 218, revertMessage: false });
  });

  it("Should pass when backing ratio below 1 but within limits", async () => {
    // 182 / 200 = 0.91 -> 9% under, within the 10% band
    await testSupplyDiff({ grossValue: 182, revertMessage: false });
  });
});
