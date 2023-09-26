const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { convexFrxEthAmoFixture, createFixtureLoader } = require("../_fixture");
const { units, oethUnits, isFork } = require("../helpers");

const log = require("../../utils/logger")("test:oeth:amo:curve:frxETH");

describe.only("Convex frxETH/OUSD AMO Strategy", function () {
  if (isFork) {
    this.timeout(0);
  } else {
    this.timeout(600000);
  }

  const loadFixture = createFixtureLoader(convexFrxEthAmoFixture);
  let fixture;
  beforeEach(async function () {
    fixture = await loadFixture();
  });

  const mint = async (amount, asset, user, vault) => {
    await asset.connect(user).mint(await units(amount, asset));
    await asset
      .connect(user)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(user)
      .mint(asset.address, await units(amount, asset), 0);
  };

  describe("Mint", function () {
    it(`Should deposit frxETH to strategy`, async function () {
      const {
        anna,
        cvxBooster,
        convexFrxETHAMOStrategy,
        curveFrxEthOethPool,
        oethVaultSigner,
        oeth,
        frxETH,
      } = fixture;

      const depositAmount = await units("300", frxETH);
      await frxETH.connect(anna).mint(depositAmount);
      await frxETH
        .connect(anna)
        .transfer(convexFrxETHAMOStrategy.address, depositAmount);

      // deposit asset to AMO
      // prettier-ignore
      const tx = await convexFrxETHAMOStrategy
          .connect(oethVaultSigner)["deposit(address,uint256)"](frxETH.address, depositAmount);

      await expect(tx)
        .emit(convexFrxETHAMOStrategy, "Deposit")
        .withArgs(frxETH.address, curveFrxEthOethPool.address, depositAmount);

      await expect(tx)
        .emit(convexFrxETHAMOStrategy, "Deposit")
        .withArgs(oeth.address, curveFrxEthOethPool.address, depositAmount);

      await expect(cvxBooster).has.an.approxBalanceOf(
        "600",
        curveFrxEthOethPool
      );
    });
  });

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return frxETH", async function () {
      const { anna, oethVault, frxETH } = fixture;
      await mint("1000", frxETH, anna, oethVault);
      await oethVault.connect(anna).redeem(oethUnits("1000"), 0);
    });
  });

  describe("Utilities", function () {
    const MAX_UINT16 = BigNumber.from(
      "0x0000000000000000000000000000000000000000ffffffffffffffffffffffff"
    );

    it("Should have Governor set", async () => {
      const { anna, convexFrxETHAMOStrategy, governor } = fixture;
      expect(await convexFrxETHAMOStrategy.connect(anna).isGovernor()).to.be
        .false;
      expect(await convexFrxETHAMOStrategy.connect(governor).isGovernor()).to.be
        .true;
      expect(await convexFrxETHAMOStrategy.governor()).to.eq(governor.address);
    });

    it("Should allow transfer of arbitrary token by Governor", async () => {
      const {
        anna,
        convexFrxETHAMOStrategy,
        governor,
        frxETH,
        oeth,
        oethVault,
      } = fixture;

      await frxETH.connect(anna).approve(oethVault.address, oethUnits("8.0"));
      await oethVault.connect(anna).mint(frxETH.address, oethUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await oeth
        .connect(anna)
        .transfer(convexFrxETHAMOStrategy.address, oethUnits("8.0"));
      // Anna asks Governor for help
      await convexFrxETHAMOStrategy
        .connect(governor)
        .transferToken(oeth.address, oethUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", oeth);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      const { anna, convexFrxETHAMOStrategy, oeth } = fixture;

      // Naughty Anna
      await expect(
        convexFrxETHAMOStrategy
          .connect(anna)
          .transferToken(oeth.address, oethUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow too large mintForStrategy", async () => {
      const { anna, governor, oethVault } = fixture;

      await oethVault.connect(governor).setAMOStrategy(anna.address, true);

      await expect(
        oethVault.connect(anna).mintForStrategy(MAX_UINT16)
      ).to.be.revertedWith("value doesn't fit in 96 bits");

      await expect(
        oethVault.connect(anna).mintForStrategy(MAX_UINT16.div(2))
      ).to.be.revertedWith("OToken mint passes threshold");
    });

    it("Should not allow too large burnForStrategy", async () => {
      const { anna, governor, oethVault } = fixture;
      await oethVault.connect(governor).setAMOStrategy(anna.address, true);

      await expect(
        oethVault.connect(anna).burnForStrategy(MAX_UINT16)
      ).to.be.revertedWith("value doesn't fit in 96 bits");

      await expect(
        oethVault.connect(anna).burnForStrategy(MAX_UINT16.div(2))
      ).to.be.revertedWith("OToken burn passes threshold");
    });

    it("Should allow Governor to reset allowances", async () => {
      const { governor, convexFrxETHAMOStrategy } = fixture;
      await expect(
        convexFrxETHAMOStrategy.connect(governor).safeApproveAllTokens()
      ).to.not.be.reverted;
    });

    it("Should not allow non-Governor to reset allowances", async () => {
      const { anna, convexFrxETHAMOStrategy } = fixture;
      await expect(
        convexFrxETHAMOStrategy.connect(anna).safeApproveAllTokens()
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Harvest", function () {
    it("Should allow the strategist to call harvest for a specific strategy", async () => {
      const { governor, harvester, convexFrxETHAMOStrategy } = fixture;
      // prettier-ignore
      await harvester
          .connect(governor)["harvest(address)"](convexFrxETHAMOStrategy.address);
    });

    it.skip("Should collect reward tokens using collect rewards on all strategies", async () => {
      const { governor, harvester, crv, cvx } = fixture;
      // Mint of MockCRVMinter mints a fixed 2e18
      await harvester.connect(governor)["harvest()"]();
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });

    it("Should collect reward tokens using collect rewards on a specific strategy", async () => {
      const { convexFrxETHAMOStrategy, governor, harvester, crv, cvx } =
        fixture;
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );

      await harvester.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](convexFrxETHAMOStrategy.address);

      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });
  });
});
