const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");
const { setERC20TokenBalance } = require("../../_fund");
const hre = require("hardhat");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve AMO strategy", function () {
  let fixture,
    oethbVault,
    curveAMOStrategy,
    oethb,
    weth,
    rafael,
    governor,
    defaultDepositor,
    curveGauge;

  const defaultDeposit = oethUnits("5");

  beforeEach(async () => {
    fixture = await baseFixture();
    oethbVault = fixture.oethbVault;
    curveAMOStrategy = fixture.curveAMOStrategy;
    oethb = fixture.oethb;
    weth = fixture.weth;
    rafael = fixture.rafael;
    governor = fixture.governor;
    defaultDepositor = rafael;
    curveGauge = fixture.curveGaugeOETHbWETH;

    // Set vaultBuffer to 100%
    await oethbVault.connect(governor).setVaultBuffer(oethUnits("1"));
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

    it("Should let user deposit", async () => {
      await mintAndDepositToStrategy();

      // Balance should be at least 1WETH + min 1 OETH
      expect(await curveAMOStrategy.checkBalance(weth.address)).to.be.gt(
        defaultDeposit
      );
      expect(await curveGauge.balanceOf(curveAMOStrategy.address)).to.be.gt(
        defaultDeposit
      );
      expect(await oethb.balanceOf(defaultDepositor.address)).to.equal(
        defaultDeposit
      );
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });
  });

  const mintAndDepositToStrategy = async ({
    userOverride,
    amount,
    returnTransaction,
  } = {}) => {
    const user = userOverride || defaultDepositor;
    amount = amount || defaultDeposit;

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    await oethbVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethbVault.governor();
    const tx = await oethbVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(curveAMOStrategy.address, [weth.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(curveAMOStrategy, "Deposit");
  };
});
