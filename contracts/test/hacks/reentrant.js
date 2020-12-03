const { expect } = require("chai");
const { utils } = require("ethers");

const { hackedVaultFixture } = require("../_fixture");
const { loadFixture, units, isFork } = require("../helpers");

describe("Reentry Attack Protection", function () {
  if (isFork) {
    this.timeout(0);
  }

  describe("Vault", function () {
    it("Should not allow malicious coin to reentrant call vault function", async function () {
      const { evilDAI, vault } = await loadFixture(hackedVaultFixture);

      // to see this fail just comment out the require in the nonReentrant() in Governable.sol
      await expect(vault.mint(evilDAI.address, 10)).to.be.revertedWith(
        "SafeERC20: low-level call failed"
      );
    });
  });
});
