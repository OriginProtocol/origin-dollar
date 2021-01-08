const { expect } = require("chai");
const { utils } = require("ethers");

const { rebornFixture } = require("../_fixture");
const { loadFixture, units, isFork, daiUnits } = require("../helpers");

describe("Reborn Attack Protection", function () {
  if (isFork) {
    this.timeout(0);
  }

  describe("Vault", function () {
    it("Should not allow reborn to call mint as different types of addresses", async function () {
      const { dai, vault, matt, reborner, rebornMint } = await loadFixture(rebornFixture);

      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await expect(rebornMint(true)).to.be.revertedWith( "Create2: Failed on deploy" );
    });
  });
});
