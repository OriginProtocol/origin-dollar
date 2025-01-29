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
    nick,
    rafael,
    governor,
    defaultDepositor,
    curvePool,
    curveGauge;

  const defaultDeposit = oethUnits("5");
  const defaultErrorTolerance = oethUnits("0.9999").div(oethUnits("1"));

  beforeEach(async () => {
    fixture = await baseFixture();
    oethbVault = fixture.oethbVault;
    curveAMOStrategy = fixture.curveAMOStrategy;
    oethb = fixture.oethb;
    weth = fixture.weth;
    nick = fixture.nick;
    rafael = fixture.rafael;
    governor = fixture.governor;
    defaultDepositor = rafael;
    curvePool = fixture.curvePoolOEthbWeth;
    curveGauge = fixture.curveGaugeOETHbWETH;

    // Start with a balanced pool
    await balancingPool();

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

      // Balance should be for 1 deposited OETH:
      // - minimum 1 WETH + 1 OETH
      // - maximum 1 WETH + 2 OETH
      expect(await curveAMOStrategy.checkBalance(weth.address)).to.be.gt(
        defaultDeposit.mul(2).mul(defaultErrorTolerance)
      );
      expect(await curveAMOStrategy.checkBalance(weth.address)).to.be.lt(
        defaultDeposit.mul(3)
      );
      expect(await curveGauge.balanceOf(curveAMOStrategy.address)).to.be.gt(
        defaultDeposit.mul(2).mul(defaultErrorTolerance)
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

  const balancingPool = async () => {
    const balances = await curvePool.get_balances();
    const balanceWETH = balances[0];
    const balanceOETH = balances[1];

    if (balanceWETH > balanceOETH) {
      const amount = balanceWETH.sub(balanceOETH);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth.connect(nick).approve(oethbVault.address, amount);
      await oethbVault.connect(nick).mint(weth.address, amount, amount);
      await oethb.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    } else if (balanceWETH < balanceOETH) {
      const amount = balanceOETH.sub(balanceWETH);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    }
  };
});
