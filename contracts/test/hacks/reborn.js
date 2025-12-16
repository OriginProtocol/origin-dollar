const { expect } = require("chai");

const { createFixtureLoader, rebornFixture } = require("../_fixture");
const { isFork, usdcUnits, ousdUnits } = require("../helpers");

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
      const { usdc, ousd, matt, rebornAddress, reborner, deployAndCall } =
        fixture;
      await usdc.connect(matt).transfer(rebornAddress, usdcUnits("4"));
      // call mint and self destruct (since account.code.length = 0) in constructor this is done
      // as an EOA from OUSD.sol's point of view
      await deployAndCall({ shouldAttack: true, shouldDestruct: true });
      // just deploy reborner contract
      await deployAndCall({ shouldAttack: false });
      // call mint and expect to be migrated to a contract address
      await reborner.mint();
      await expect(await ousd.balanceOf(rebornAddress)).to.equal(
        ousdUnits("2")
      );
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("2"));
    });

    it("Should correctly do accounting when reborn calls burn as different types of addresses", async function () {
      const { usdc, ousd, matt, reborner, rebornAddress, deployAndCall } =
        fixture;
      await usdc.connect(matt).transfer(reborner.address, usdcUnits("4"));
      // call mint and self destruct (since account.code.length = 0) in constructor this is done
      // as an EOA from OUSD.sol's point of view
      await deployAndCall({ shouldAttack: true, shouldDestruct: true });
      await deployAndCall({ shouldAttack: true, shouldDestruct: true });

      await deployAndCall({ shouldAttack: false });
      // call redeem and expect to be migrated to a contract address
      await reborner.redeem();
      await expect(await ousd.balanceOf(rebornAddress)).to.equal(
        ousdUnits("1")
      );
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("1"));
    });

    it("Should correctly do accounting when reborn calls transfer as different types of addresses", async function () {
      const { usdc, ousd, matt, reborner, rebornAddress, deployAndCall } =
        fixture;
      await usdc.connect(matt).transfer(reborner.address, usdcUnits("4"));
      // call mint and self destruct (since account.code.length = 0) in constructor this is done
      // as an EOA from OUSD.sol's point of view
      await deployAndCall({ shouldAttack: true, shouldDestruct: true });
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("0"));
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("0"));

      await deployAndCall({ shouldAttack: false });
      // call transfer and expect to be migrated to a contract address
      await reborner.transfer();
      await expect(await ousd.balanceOf(rebornAddress)).to.equal(
        ousdUnits("0")
      );
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("0"));
      await reborner.mint();
      await expect(await ousd.balanceOf(rebornAddress)).to.equal(
        ousdUnits("1")
      );
      expect(await ousd.nonRebasingSupply()).to.equal(ousdUnits("1"));
    });

    it("Should have correct balance even after recreating", async function () {
      const { usdc, matt, reborner, deployAndCall, ousd } = fixture;

      // Mint one OUSD and self-destruct
      await usdc.connect(matt).transfer(reborner.address, usdcUnits("4"));
      await deployAndCall({ shouldAttack: true, shouldDestruct: true });
      await expect(reborner).to.have.a.balanceOf("1", ousd);

      // Recreate the contract at the same address but expect
      // to not have any change in balance (outside constructor)
      await deployAndCall({ shouldAttack: false });
      await expect(reborner).to.have.a.balanceOf("1", ousd);
      await reborner.mint();
      await expect(reborner).to.have.a.balanceOf("2", ousd);
    });
  });
});
