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
      const { dai, matt, reborner, rebornAttack } = await loadFixture(
        rebornFixture
      );

      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await expect(rebornAttack(true)).to.be.revertedWith(
        "Create2: Failed on deploy"
      );
    });

    it("Should not allow reborn to call burn as different types of addresses", async function () {
      const { dai, matt, reborner, rebornAttack } = await loadFixture(
        rebornFixture
      );

      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await expect(rebornAttack(true, 1)).to.be.revertedWith(
        "Create2: Failed on deploy"
      );
    });

    it("Should not allow reborn to call transfer as different types of addresses", async function () {
      const { dai, matt, reborner, rebornAttack } = await loadFixture(
        rebornFixture
      );

      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();

      await expect(rebornAttack(true, 2)).to.be.revertedWith(
        "Create2: Failed on deploy"
      );
    });

    it("Should have correct balance even after recreating", async function () {
      const { dai, matt, reborner, rebornAttack, ousd } = await loadFixture(
        rebornFixture
      );

      // Mint one OUSD and self-destruct
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await expect(reborner).to.have.a.balanceOf("1", ousd);
      await reborner.bye();

      // Recreate the contract at the same address but expect
      // to not have any change in balance (outside constructor)
      await rebornAttack(false);
      await expect(reborner).to.have.a.balanceOf("1", ousd);
      await reborner.mint();
      await expect(reborner).to.have.a.balanceOf("2", ousd);
    });
  });
});
