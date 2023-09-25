const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { convexOusdAmoFixture, createFixtureLoader } = require("../_fixture");
const {
  daiUnits,
  ousdUnits,
  units,
  expectApproxSupply,
  isFork,
  usdtUnits,
} = require("../helpers");
const { resolveAsset } = require("../../utils/assets");

describe("Convex OUSD/3Pool AMO Strategy", function () {
  if (isFork) {
    this.timeout(0);
  } else {
    this.timeout(600000);
  }

  let anna,
    ousd,
    vault,
    vaultSigner,
    harvester,
    governor,
    crv,
    cvx,
    convexOusdAMOStrategy,
    metapoolToken,
    cvxBooster,
    usdt,
    usdc,
    dai;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(await units(amount, asset));
    await asset
      .connect(anna)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, await units(amount, asset), 0);
  };

  const loadFixture = createFixtureLoader(convexOusdAmoFixture);
  beforeEach(async function () {
    const fixture = await loadFixture();
    anna = fixture.anna;
    vault = fixture.vault;
    vaultSigner = fixture.vaultSigner;
    harvester = fixture.harvester;
    ousd = fixture.ousd;
    governor = fixture.governor;
    crv = fixture.crv;
    cvx = fixture.cvx;
    convexOusdAMOStrategy = fixture.convexOusdAMOStrategy;
    metapoolToken = fixture.metapoolToken;
    cvxBooster = fixture.cvxBooster;
    usdt = fixture.usdt;
    usdc = fixture.usdc;
    dai = fixture.dai;
  });

  describe("Mint", function () {
    ["DAI", "USDC", "USDT"].forEach((symbol) => {
      it(`Should deposit ${symbol} to strategy`, async function () {
        await expectApproxSupply(ousd, ousdUnits("200"));

        const asset = await resolveAsset(symbol);
        const depositAmount = await units("30000.00", asset);
        await asset.connect(anna).mint(depositAmount);
        await asset
          .connect(anna)
          .transfer(convexOusdAMOStrategy.address, depositAmount);

        // deposit USDT to AMO
        // prettier-ignore
        const tx = await convexOusdAMOStrategy
          .connect(vaultSigner)["deposit(address,uint256)"](asset.address, depositAmount);
        // emit Deposit event for USDT
        await expect(tx)
          .to.emit(convexOusdAMOStrategy, "Deposit")
          .withArgs(asset.address, metapoolToken.address, depositAmount);
        // emit Deposit event for OUSD
        await expect(tx)
          .to.emit(convexOusdAMOStrategy, "Deposit")
          .withNamedArgs({
            _asset: ousd.address,
            _pToken: metapoolToken.address,
            // _amount: depositAmount,
          });

        await expect(cvxBooster).has.an.approxBalanceOf("60000", metapoolToken);
      });
    });
    it(`Should deposit multiple assets to strategy`, async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));

      const daiAmount = await daiUnits("30000.00");
      await dai.connect(anna).mint(daiAmount);
      await dai
        .connect(anna)
        .transfer(convexOusdAMOStrategy.address, daiAmount);

      const usdtAmount = await usdtUnits("30000.00");
      await usdt.connect(anna).mint(usdtAmount);
      await usdt
        .connect(anna)
        .transfer(convexOusdAMOStrategy.address, usdtAmount);

      // deposit USDT to AMO
      // prettier-ignore
      const tx = await convexOusdAMOStrategy
        .connect(vaultSigner)["deposit(address[],uint256[])"](
          [dai.address, usdt.address],
          [daiAmount, usdtAmount]
        );
      // emit Deposit event for DAI
      await expect(tx)
        .to.emit(convexOusdAMOStrategy, "Deposit")
        .withArgs(dai.address, metapoolToken.address, daiAmount);
      // emit Deposit event for USDT
      await expect(tx)
        .to.emit(convexOusdAMOStrategy, "Deposit")
        .withArgs(usdt.address, metapoolToken.address, usdtAmount);
      // emit Deposit event for OUSD
      await expect(tx).to.emit(convexOusdAMOStrategy, "Deposit").withNamedArgs({
        _asset: ousd.address,
        _pToken: metapoolToken.address,
        // _amount: depositAmount,
      });

      await expect(cvxBooster).has.an.approxBalanceOf("120000", metapoolToken);
    });

    it("Should use a minimum LP token amount when depositing USDT into metapool", async function () {
      await expect(mint("29000", usdt)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });

    it("Should use a minimum LP token amount when depositing USDC into metapool", async function () {
      await expect(mint("29000", usdc)).to.be.revertedWith(
        "Slippage ruined your day"
      );
    });
  });

  describe("Redeem", function () {
    it("Should be able to unstake from gauge and return USDT", async function () {
      await expectApproxSupply(ousd, ousdUnits("200"));
      await mint("10000.00", dai);
      await mint("10000.00", usdc);
      await mint("10000.00", usdt);
      await vault.connect(anna).redeem(ousdUnits("20000"), 0);
      // DAI minted OUSD has not been deployed to OUSD AMO strategy for that reason the
      // total supply of OUSD has not doubled
      await expectApproxSupply(ousd, ousdUnits("10200"));
    });
  });

  describe("Utilities", function () {
    const MAX_UINT16 = BigNumber.from(
      "0x0000000000000000000000000000000000000000ffffffffffffffffffffffff"
    );
    it("Should not initialize a second time", async () => {
      await expect(
        convexOusdAMOStrategy.connect(governor).initialize([])
      ).to.revertedWith("Initializable: contract is already initialized");
    });

    it("Should have Governor set", async () => {
      expect(await convexOusdAMOStrategy.connect(anna).isGovernor()).to.be
        .false;
      expect(await convexOusdAMOStrategy.connect(governor).isGovernor()).to.be
        .true;
      expect(await convexOusdAMOStrategy.governor()).to.eq(governor.address);
    });

    it("Should allow transfer of arbitrary token by Governor", async () => {
      await dai.connect(anna).approve(vault.address, daiUnits("8.0"));
      await vault.connect(anna).mint(dai.address, daiUnits("8.0"), 0);
      // Anna sends her OUSD directly to Strategy
      await ousd
        .connect(anna)
        .transfer(convexOusdAMOStrategy.address, ousdUnits("8.0"));
      // Anna asks Governor for help
      await convexOusdAMOStrategy
        .connect(governor)
        .transferToken(ousd.address, ousdUnits("8.0"));
      await expect(governor).has.a.balanceOf("8.0", ousd);
    });

    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      // Naughty Anna
      await expect(
        convexOusdAMOStrategy
          .connect(anna)
          .transferToken(ousd.address, ousdUnits("8.0"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow too large mintForStrategy", async () => {
      await vault.connect(governor).setAMOStrategy(anna.address, true);

      await expect(
        vault.connect(anna).mintForStrategy(MAX_UINT16)
      ).to.be.revertedWith("value doesn't fit in 96 bits");

      await expect(
        vault.connect(anna).mintForStrategy(MAX_UINT16.div(2))
      ).to.be.revertedWith("OToken mint passes threshold");
    });

    it("Should not allow too large burnForStrategy", async () => {
      await vault.connect(governor).setAMOStrategy(anna.address, true);

      await expect(
        vault.connect(anna).burnForStrategy(MAX_UINT16)
      ).to.be.revertedWith("value doesn't fit in 96 bits");

      await expect(
        vault.connect(anna).burnForStrategy(MAX_UINT16.div(2))
      ).to.be.revertedWith("OToken burn passes threshold");
    });

    it("Should allow Governor to reset allowances", async () => {
      await expect(
        convexOusdAMOStrategy.connect(governor).safeApproveAllTokens()
      ).to.not.be.reverted;
    });

    it("Should not allow non-Governor to reset allowances", async () => {
      await expect(
        convexOusdAMOStrategy.connect(anna).safeApproveAllTokens()
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Harvest", function () {
    it("Should allow the strategist to call harvest for a specific strategy", async () => {
      // prettier-ignore
      await harvester
        .connect(governor)["harvest(address)"](convexOusdAMOStrategy.address);
    });

    it("Should collect reward tokens using collect rewards on all strategies", async () => {
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
      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("0", 18)
      );

      await harvester.connect(governor)[
        // eslint-disable-next-line
        "harvest(address)"
      ](convexOusdAMOStrategy.address);

      await expect(await crv.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("2", 18)
      );
      await expect(await cvx.balanceOf(harvester.address)).to.be.equal(
        utils.parseUnits("3", 18)
      );
    });
  });
});
