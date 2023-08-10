const { expect } = require("chai");

const { createFixtureLoader, hackedVaultFixture } = require("../_fixture");
const { isFork } = require("../helpers");

describe("Reentry Attack Protection", function () {
  if (isFork) {
    this.timeout(0);
  }

  describe("Vault", function () {
    const loadFixture = createFixtureLoader(hackedVaultFixture);
    it("Should not allow malicious coin to reentrant call vault function", async function () {
      const { evilDAI, vault } = await loadFixture();

      // to see this fail just comment out the require in the nonReentrant() in Governable.sol
      await expect(vault.mint(evilDAI.address, 10, 0)).to.be.revertedWith(
        "Reentrant call"
      );
    });
  });
});
