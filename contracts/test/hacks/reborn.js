const { expect } = require("chai");

const { createFixtureLoader, rebornFixture } = require("../_fixture");
const { isFork, daiUnits, ousdUnits } = require("../helpers");

describe("Reborn Attack Protection", function () {
  if (isFork) {
    this.timeout(0);
  }

  describe("Vault", function () {
    let fixture;
    const loadFixture = createFixtureLoader(rebornFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });
    it("Should correctly do accounting when reborn calls mint as different types of addresses", async function () {
      const { dai, ousd, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await rebornAttack(true);
      await expect(reborner).to.have.a.balanceOf("2", ousd);
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("2"));
    });

    it("Should correctly do accounting when reborn calls burn as different types of addresses", async function () {
      const { dai, ousd, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      await rebornAttack(true, 1);
      await expect(reborner).to.have.a.balanceOf("0", ousd);
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("0"));
    });

    it("Should correctly do accounting when reborn calls transfer as different types of addresses", async function () {
      const { dai, ousd, matt, reborner, rebornAttack } = fixture;
      await dai.connect(matt).transfer(reborner.address, daiUnits("4"));
      await reborner.mint();
      await reborner.bye();
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("1"));
      await rebornAttack(true, 2);
      await expect(reborner).to.have.a.balanceOf("0", ousd);
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("0"));
    });

    it("Should have correct balance even after recreating", async function () {
      const { dai, matt, reborner, rebornAttack, ousd } = fixture;

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
