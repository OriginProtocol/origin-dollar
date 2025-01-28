const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve AMO strategy", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
    const { oethbVault, governor, weth, curveAMOStrategy, nick } = fixture;

    // Set vaultBuffer to 0%
    await oethbVault.connect(governor).setVaultBuffer(oethUnits("0"));
    // Set Curve AMO as default strategy on the vault
    await oethbVault
      .connect(governor)
      .setAssetDefaultStrategy(weth.address, curveAMOStrategy.address);

    // Nick approve max to vault
    await weth
      .connect(nick)
      .approve(oethbVault.address, oethUnits("100000000"));
  });

  describe("Initial paramaters", () => {
    it("Should have correct parameters after deployment", async () => {
      const { curveAMOStrategy, oethbVault, oethb, weth } = fixture;
      expect(await curveAMOStrategy.platformAddress()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.vaultAddress()).to.equal(
        oethbVault.address
      );
      expect(await curveAMOStrategy.gauge()).to.equal(
        addresses.base.OETHb_WETH.gauge
      );
      expect(await curveAMOStrategy.curvePool()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.lpToken()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.oeth()).to.equal(oethb.address);
      expect(await curveAMOStrategy.weth()).to.equal(weth.address);
      expect(await curveAMOStrategy.governor()).to.equal(
        addresses.base.governor
      );
      expect(await curveAMOStrategy.rewardTokenAddresses(0)).to.equal(
        addresses.base.CRV
      );
    });

    it("Should user deposit", async () => {
      const { oethbVault, curveAMOStrategy, oethb, weth, nick } = fixture;

      const balanceBefore = await curveAMOStrategy.checkBalance(weth.address);
      await oethbVault
        .connect(nick)
        .mint(weth.address, oethUnits("1"), oethUnits("0"));
      const balanceAfter = await curveAMOStrategy.checkBalance(weth.address);
      console.log(balanceBefore.toString());
      console.log(balanceAfter.toString());

      expect(await oethb.balanceOf(nick.address)).to.equal(oethUnits("1"));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(balanceAfter.sub(balanceBefore)).to.equal(oethUnits("1"));
    });
  });
});
